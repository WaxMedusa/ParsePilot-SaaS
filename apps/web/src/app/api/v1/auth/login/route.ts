import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';
import { increment } from '@/lib/observability/metrics';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, passwordHash: true, disabledAt: true },
    });

    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid || user.disabledAt) {
      await recordAudit({
        action: 'auth.login_failed',
        ipHash: context.ipHash,
        requestId: context.requestId,
        metadata: {},
      });
      await increment('auth_login_failures');
      throw ApiError.unauthorized('Email or password is incorrect');
    }

    const session = await createSession(user.id, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipHash: context.ipHash,
    });
    await setSessionCookie(session.token, session.expiresAt);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordAudit({
      action: 'auth.login',
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      ipHash: context.ipHash,
      requestId: context.requestId,
    });

    return ok(
      {
        user: { id: user.id, email: user.email, name: user.name },
        sessionExpiresAt: session.expiresAt.toISOString(),
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'none', rateLimit: { limit: 12, windowMs: 5 * 60 * 1000, per: 'ip' } },
);
