import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { appConfig } from '@/lib/env';
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
  const headers: Record<string, string> = { 'Content-Type': body.contentType };
  if (appConfig.storageDriver === 'supabase') {
    // The signed token carries the upsert decision; sending these explicitly
    // matches supabase-js and avoids provider-side defaults changing uploads.
    headers['x-upsert'] = 'false';
    headers['cache-control'] = 'max-age=3600';
  } else if (appConfig.storageDriver === 's3' && appConfig.s3.serverSideEncryption) {
    // The header must match what the presigned URL was signed with; sending it
    // to a bucket that uses its own default (SSE-KMS, or R2/B2) breaks the
    // signature check.
    headers['x-amz-server-side-encryption'] = appConfig.s3.serverSideEncryption;
  }
  return ok(
    {
      storageKey,
      uploadUrl: url,
      method: 'PUT',
      headers,
      expiresInSeconds: retentionConfig.signedUrlSeconds * 4,
      direct: appConfig.storageDriver !== 'local' ? 'presigned' : 'internal',
    },
    { requestId: context.requestId },
  );
});
