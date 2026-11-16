import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { resolveWorkspaceAccess } from '@/lib/auth/authorization';
import { removeTeamMember, updateMemberRole } from '@/lib/workspaces/team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ role: z.enum(['admin', 'member', 'viewer']) });

export const PATCH = withApi(
  async (request, context) => {
    await resolveWorkspaceAccess(context.auth!.user.id, context.params.id, 'admin');
    const body = schema.parse(await request.json());
    await updateMemberRole({
      workspaceId: context.params.id,
      actorId: context.auth!.user.id,
      memberId: context.params.memberId,
      role: body.role,
    });
    return ok({ updated: true }, { requestId: context.requestId });
  },
  { workspace: false, rateLimit: { limit: 60, windowMs: 60 * 60 * 1000, per: 'user' } },
);

export const DELETE = withApi(
  async (_request, context) => {
    await resolveWorkspaceAccess(context.auth!.user.id, context.params.id, 'admin');
    await removeTeamMember({
      workspaceId: context.params.id,
      actorId: context.auth!.user.id,
      memberId: context.params.memberId,
    });
    return ok({ removed: true }, { requestId: context.requestId });
  },
  { workspace: false, rateLimit: { limit: 60, windowMs: 60 * 60 * 1000, per: 'user' } },
);
