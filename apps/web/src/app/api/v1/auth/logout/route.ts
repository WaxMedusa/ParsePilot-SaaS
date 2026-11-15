import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { readSessionToken, revokeSessionByToken, clearSessionCookie } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

export const POST = withApi(
  async (request, context) => {
    const token = await readSessionToken(request);
    if (token) await revokeSessionByToken(token);
    await clearSessionCookie();
    await recordAudit({
      action: 'auth.logout',
      actorId: context.auth?.user.id,
      targetType: 'session',
      targetId: context.auth?.sessionId,
      requestId: context.requestId,
    });
    return ok({ signedOut: true }, { requestId: context.requestId });
  },
  { auth: 'required' },
);
