import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { getUsageSnapshot } from '@/lib/billing/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const snapshot = await getUsageSnapshot(context.workspace!.id);
    return ok(
      {
        workspaceId: context.workspace!.id,
        plan: snapshot.plan,
        subscription: snapshot.subscription,
        billingConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      },
      { requestId: context.requestId },
    );
  },
  { workspace: { minRole: 'viewer' } },
);
