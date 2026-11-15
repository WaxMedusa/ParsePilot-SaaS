import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { hashPassword, validatePasswordPolicy } from '@/lib/auth/password';
import { hashToken, revokeAllUserSessions } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(1).max(200),
});

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const policy = validatePasswordPolicy(body.password);
    if (!policy.ok) throw ApiError.validation(policy.problems.map((problem) => ({ path: 'password', message: problem })));

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(body.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw ApiError.badRequest('This password reset link is invalid or has expired');
    }

    const passwordHash = await hashPassword(body.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    await revokeAllUserSessions(record.userId);
    await recordAudit({
      action: 'auth.password_reset_completed',
      actorId: record.userId,
      targetType: 'user',
      targetId: record.userId,
      requestId: context.requestId,
    });
    return ok({ reset: true }, { requestId: context.requestId });
  },
  { auth: 'none', rateLimit: { limit: 10, windowMs: 15 * 60 * 1000, per: 'ip' } },
);
