import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { resolveWorkspaceAccess } from '@/lib/auth/authorization';
import { revokeTeamInvitation } from '@/lib/workspaces/team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withApi(
  async (_request, context) => {
    await resolveWorkspaceAccess(context.auth!.user.id, context.params.id, 'admin');
    await revokeTeamInvitation({
      workspaceId: context.params.id,
      actorId: context.auth!.user.id,
      invitationId: context.params.invitationId,
    });
    return ok({ revoked: true }, { requestId: context.requestId });
  },
  { workspace: false, rateLimit: { limit: 60, windowMs: 60 * 60 * 1000, per: 'user' } },
);
