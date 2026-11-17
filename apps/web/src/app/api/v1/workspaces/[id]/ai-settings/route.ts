import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { recordAudit } from '@/lib/audit';
import { clearAiSettings, getAiSettingsView, saveAiSettings } from '@/lib/ai/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().trim().min(1).max(300),
  model: z.string().trim().min(1).max(120),
  // An omitted or empty key keeps the stored one, so the UI never has to
  // display the secret to let a user change the model or URL.
  apiKey: z.string().trim().max(500).optional(),
});

function assertSelectedWorkspace(context: { params: Record<string, string>; workspace: { id: string } | null }) {
  if (context.params.id !== context.workspace!.id) {
    throw ApiError.forbidden('You can only change settings for the workspace selected for this request');
  }
}

export const GET = withApi(
  async (request, context) => {
    assertSelectedWorkspace(context);
    return ok(await getAiSettingsView(context.workspace!.id), { requestId: context.requestId });
  },
  { workspace: { minRole: 'viewer' } },
);

export const PUT = withApi(
  async (request, context) => {
    assertSelectedWorkspace(context);
    const body = schema.parse(await request.json());
    const view = await saveAiSettings({
      workspaceId: context.workspace!.id,
      userId: context.auth!.user.id,
      enabled: body.enabled,
      baseUrl: body.baseUrl,
      model: body.model,
      apiKey: body.apiKey || undefined,
    });
    await recordAudit({
      action: 'settings.ai_updated',
      workspaceId: context.workspace!.id,
      actorId: context.auth!.user.id,
      targetType: 'workspace',
      targetId: context.workspace!.id,
      metadata: {
        baseUrl: view.baseUrl,
        model: view.model,
        enabled: view.enabled,
        keyChanged: Boolean(body.apiKey),
      },
    });
    return ok(view, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 10, windowMs: 60_000, per: 'user' } },
);

export const DELETE = withApi(
  async (request, context) => {
    assertSelectedWorkspace(context);
    await clearAiSettings(context.workspace!.id);
    await recordAudit({
      action: 'settings.ai_cleared',
      workspaceId: context.workspace!.id,
      actorId: context.auth!.user.id,
      targetType: 'workspace',
      targetId: context.workspace!.id,
    });
    return ok({ removed: true }, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 10, windowMs: 60_000, per: 'user' } },
);
