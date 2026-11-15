import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { listPublicPlans } from '@/lib/billing/plans';

export const runtime = 'nodejs';

export const GET = withApi(
  async (request, context) => {
    const plans = await listPublicPlans();
    return ok(plans, {
      requestId: context.requestId,
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  },
  { auth: 'none', rateLimit: { limit: 60, windowMs: 60_000, per: 'ip' } },
);
