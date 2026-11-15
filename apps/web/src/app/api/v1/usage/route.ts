import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { getUsageSnapshot } from '@/lib/billing/usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const snapshot = await getUsageSnapshot(context.workspace!.id);
    return ok(snapshot, { requestId: context.requestId });
  },
  { workspace: { minRole: 'viewer' } },
);
