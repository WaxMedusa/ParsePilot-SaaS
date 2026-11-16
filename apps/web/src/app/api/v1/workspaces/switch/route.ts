import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { resolveWorkspaceAccess } from '@/lib/auth/authorization';
import { setWorkspaceCookie } from '@/lib/workspaces/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ workspaceId: z.string().uuid() });

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const workspace = await resolveWorkspaceAccess(context.auth!.user.id, body.workspaceId, 'viewer');
    await setWorkspaceCookie(workspace.id);
    return ok(workspace, { requestId: context.requestId });
  },
  { workspace: false, rateLimit: { limit: 60, windowMs: 60 * 60 * 1000, per: 'user' } },
);
