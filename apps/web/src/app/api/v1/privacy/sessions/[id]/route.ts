import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { revokeSessionById } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withApi(
  async (request, context) => {
    const session = await prisma.session.findFirst({
      where: { id: context.params.id, userId: context.auth!.user.id },
      select: { id: true },
    });
    if (!session) throw ApiError.notFound('Session not found');
    if (session.id === context.auth!.sessionId) {
      throw ApiError.badRequest('Sign out from this device instead of revoking the current session');
    }
    await revokeSessionById(session.id);
    await recordAudit({
      action: 'session.revoked',
      actorId: context.auth!.user.id,
      targetType: 'session',
      targetId: session.id,
      requestId: context.requestId,
    });
    return ok({ revoked: true }, { requestId: context.requestId });
  },
  { auth: 'required' },
);
