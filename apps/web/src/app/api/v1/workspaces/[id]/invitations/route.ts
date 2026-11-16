import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created } from '@/lib/http/respond';
import { resolveWorkspaceAccess } from '@/lib/auth/authorization';
import { inviteTeamMember } from '@/lib/workspaces/team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['admin', 'member', 'viewer']),
});

export const POST = withApi(
  async (request, context) => {
    await resolveWorkspaceAccess(context.auth!.user.id, context.params.id, 'admin');
    const body = schema.parse(await request.json());
    const result = await inviteTeamMember({
      workspaceId: context.params.id,
      actorId: context.auth!.user.id,
      email: body.email,
      role: body.role,
    });
    return created(result, { requestId: context.requestId });
  },
  { workspace: false, rateLimit: { limit: 20, windowMs: 60 * 60 * 1000, per: 'user' } },
);
