import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { acceptInvitation } from '@/lib/workspaces/team';
import { setWorkspaceCookie } from '@/lib/workspaces/cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(20).max(200) });

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const workspace = await acceptInvitation({
      userId: context.auth!.user.id,
      userEmail: context.auth!.user.email,
      token: body.token,
    });
    await setWorkspaceCookie(workspace.id);
    return ok(workspace, { requestId: context.requestId });
  },
  { workspace: false, rateLimit: { limit: 20, windowMs: 15 * 60 * 1000, per: 'user' } },
);
