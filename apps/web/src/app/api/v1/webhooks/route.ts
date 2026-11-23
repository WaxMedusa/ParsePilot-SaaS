import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created, ok, noContent } from '@/lib/http/respond';
import { listWebhookEndpoints, createWebhookEndpoint, deleteWebhookEndpoint } from '@/lib/webhooks/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().url().max(2000),
  events: z.array(z.string()).min(1).max(50),
  active: z.boolean().optional(),
});

export const GET = withApi(
  async (request, context) => {
    const endpoints = await listWebhookEndpoints(context.workspace!.id);
    return ok(endpoints, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 120, windowMs: 60_000, per: 'user' } },
);

export const POST = withApi(
  async (request, context) => {
    const body = createSchema.parse(await request.json());
    const endpoint = await createWebhookEndpoint({
      workspaceId: context.workspace!.id,
      userId: context.auth!.user.id,
      name: body.name,
      url: body.url,
      events: body.events,
      active: body.active ?? true,
      requestId: context.requestId,
    });
    return created(endpoint, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 30, windowMs: 60_000, per: 'user' } },
);