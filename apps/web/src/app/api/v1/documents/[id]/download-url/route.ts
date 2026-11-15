import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { createDocumentDownloadUrl } from '@/lib/documents/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (request, context) => {
    const result = await createDocumentDownloadUrl({
      documentId: context.params.id,
      workspaceId: context.workspace!.id,
      actorId: context.auth!.user.id,
    });
    return ok(result, { requestId: context.requestId });
  },
  { workspace: { minRole: 'viewer' }, rateLimit: { limit: 60, windowMs: 60 * 60 * 1000, per: 'user' } },
);
