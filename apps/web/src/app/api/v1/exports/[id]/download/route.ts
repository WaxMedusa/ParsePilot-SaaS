import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { buildDownloadUrl } from '@/lib/exports/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const result = await buildDownloadUrl(context.workspace!.id, context.params.id, context.auth!.user.id);
    return ok(result, { requestId: context.requestId });
  },
  { workspace: { minRole: 'viewer' }, rateLimit: { limit: 60, windowMs: 60 * 60 * 1000, per: 'user' } },
);
