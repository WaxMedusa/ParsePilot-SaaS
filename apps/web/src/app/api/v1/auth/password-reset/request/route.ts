import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { hashToken } from '@/lib/auth/session';
import { retentionConfig } from '@/config/retention';
import { recordAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { appUrl, isProduction } from '@/lib/env';
import { passwordResetEmail } from '@/lib/email/templates';
import { sendTransactionalEmail } from '@/lib/email/service';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const POST = withApi(
  async (request, context) => {
    const { email } = schema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, disabledAt: true },
    });

    let devToken: string | null = null;
    if (user && !user.disabledAt) {
      const token = randomBytes(32).toString('base64url');
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + retentionConfig.passwordResetMinutes * 60 * 1000),
        },
      });
      const message = passwordResetEmail({
        name: user.name,
        resetUrl,
        expiresMinutes: retentionConfig.passwordResetMinutes,
      });
      const delivery = await sendTransactionalEmail({ to: user.email, ...message });
      await recordAudit({
        action: 'auth.password_reset_requested',
        actorId: user.id,
        targetType: 'user',
        targetId: user.id,
        requestId: context.requestId,
      });
      logger.info('password_reset_token_created', {
        userId: user.id,
        emailSent: delivery.sent,
      });
      if (!isProduction && !delivery.sent) devToken = resetUrl;
    }

    return ok(
      {
        message: 'If an account exists for that email, we will send password reset instructions.',
        ...(devToken ? { developmentResetUrl: devToken } : {}),
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'none', rateLimit: { limit: 6, windowMs: 15 * 60 * 1000, per: 'ip' } },
);
