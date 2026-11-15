import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { buildExportDataset } from '@/lib/exports/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withInternalService(async (request, context) => {
  const exportRecord = await prisma.export.findUnique({
    where: { id: context.params.id },
    select: { workspaceId: true, status: true },
  });
  if (!exportRecord) throw ApiError.notFound('Export not found');
  if (exportRecord.status === 'expired') throw ApiError.conflict('Export has expired');

  const dataset = await buildExportDataset(exportRecord.workspaceId, context.params.id);
  return ok(dataset, { requestId: context.requestId });
});
