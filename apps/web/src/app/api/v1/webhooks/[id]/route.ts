import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok, noContent } from '@/lib/http/respond';
import { getWebhookEndpoint, updateWebhookEndpoint, deleteWebhookEndpoint } from '@/lib/webhooks/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  url: z.string().url().max(2000).optional(),
  events: z.array(z.string()).min(1).max(50).optional(),
  active: z.boolean().optional(),
});

export const GET = withApi(
  async (request, context) => {
    const endpoint = await getWebhookEndpoint(context.params.id, context.workspace!.id);
    if (!endpoint) return noContent({ requestId: context.requestId });
    return ok(endpoint, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 120, windowMs: 60_000, per: 'user' } },
);

export const PATCH = withApi(
  async (request, context) => {
    const body = updateSchema.parse(await request.json());
    const endpoint = await updateWebhookEndpoint(
      context.params.id,
      context.workspace!.id,
      body,
    );
    return ok(endpoint, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 30, windowMs: 60_000, per: 'user' } },
);

export const DELETE = withApi(
  async (request, context) => {
    await deleteWebhookEndpoint(context.params.id, context.workspace!.id);
    return noContent({ requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 30, windowMs: 60_000, per: 'user' } },
);