import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { createDocumentUploadTarget } from '@/lib/documents/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  filename: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive(),
  contentType: z.string().trim().max(120).nullish(),
});

/**
 * Returns a short-lived presigned PUT so the browser can send a document
 * straight to private object storage. The plan size limit is enforced here,
 * and again when `POST /api/v1/documents` validates the stored object.
 */
export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const target = await createDocumentUploadTarget({
      workspaceId: context.workspace!.id,
      userId: context.auth!.user.id,
      filename: body.filename,
      sizeBytes: body.sizeBytes,
      contentType: body.contentType ?? null,
    });
    return ok(target, { requestId: context.requestId });
  },
  {
    workspace: { minRole: 'member' },
    rateLimit: { limit: 120, windowMs: 60 * 60 * 1000, per: 'user' },
  },
);
