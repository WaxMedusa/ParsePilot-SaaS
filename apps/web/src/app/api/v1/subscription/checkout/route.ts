import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { createCheckoutSession } from '@/lib/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ planCode: z.string().trim().min(2).max(40) });

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const session = await createCheckoutSession({
      workspaceId: context.workspace!.id,
      planCode: body.planCode,
      userEmail: context.auth!.user.email,
    });
    return ok(session, { requestId: context.requestId });
  },
  { workspace: { minRole: 'owner' }, rateLimit: { limit: 15, windowMs: 60 * 60 * 1000, per: 'user' } },
);
