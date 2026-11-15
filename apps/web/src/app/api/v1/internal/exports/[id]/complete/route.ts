import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { completeExport } from '@/lib/exports/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  storageKey: z.string().min(5).max(300),
  sizeBytes: z.number().int().min(1).max(200 * 1024 * 1024),
  rowCount: z.number().int().min(0).max(100_000),
  workerId: z.string().min(1).max(120),
});

export const POST = withInternalService(async (request, context) => {
  const body = schema.parse(await request.json());
  const exportRecord = await prisma.export.findUnique({
    where: { id: context.params.id },
    select: { id: true, workspaceId: true },
  });
  if (!exportRecord) throw ApiError.notFound('Export not found');

  // The artefact must live under this workspace's prefix.
  if (!body.storageKey.startsWith(`workspaces/${exportRecord.workspaceId}/`)) {
    throw ApiError.validation([{ path: 'storageKey', message: 'Artefact key is outside the workspace prefix' }]);
  }

  const completed = await completeExport(context.params.id, {
    storageKey: body.storageKey,
    sizeBytes: body.sizeBytes,
    rowCount: body.rowCount,
  });

  await prisma.processingJob.updateMany({
    where: { exportId: exportRecord.id, status: { in: ['running', 'queued'] } },
    data: { status: 'succeeded', stage: 'completed', finishedAt: new Date(), activeKey: null, heartbeatAt: null },
  });

  return ok({ completed: true, exportId: completed.id, expiresAt: completed.expiresAt?.toISOString() ?? null }, { requestId: context.requestId });
});
