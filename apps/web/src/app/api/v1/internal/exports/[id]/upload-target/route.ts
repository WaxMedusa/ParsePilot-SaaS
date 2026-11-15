import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { retentionConfig } from '@/config/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  contentType: z.string().trim().min(3).max(120),
});

export const POST = withInternalService(async (request, context) => {
  const body = schema.parse(await request.json());
  const exportRecord = await prisma.export.findUnique({
    where: { id: context.params.id },
    select: { id: true, workspaceId: true, format: true },
  });
  if (!exportRecord) throw ApiError.notFound('Export not found');

  const extension = exportRecord.format === 'xlsx' ? 'xlsx' : 'csv';
  const storageKey = `workspaces/${exportRecord.workspaceId}/exports/${exportRecord.id}-${crypto.randomUUID()}.${extension}`;
  const url = await getStorage().createUploadUrl(storageKey, body.contentType, retentionConfig.signedUrlSeconds * 4);
  return ok(
    {
      storageKey,
      uploadUrl: url,
      method: 'PUT',
      headers: { 'Content-Type': body.contentType },
      expiresInSeconds: retentionConfig.signedUrlSeconds * 4,
      direct: process.env.STORAGE_DRIVER === 's3' ? 'presigned' : 'internal',
    },
    { requestId: context.requestId },
  );
});
