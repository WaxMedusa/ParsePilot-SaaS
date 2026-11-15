import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { createPortalSession } from '@/lib/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (request, context) => {
    const session = await createPortalSession(context.workspace!.id);
    return ok(session, { requestId: context.requestId });
  },
  { workspace: { minRole: 'owner' }, rateLimit: { limit: 15, windowMs: 60 * 60 * 1000, per: 'user' } },
);
