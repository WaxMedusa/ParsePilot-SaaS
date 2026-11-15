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

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const POST = withApi(
  async (request, context) => {
    const { email } = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, disabledAt: true } });

    let devToken: string | null = null;
    if (user && !user.disabledAt) {
      const token = randomBytes(32).toString('base64url');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + retentionConfig.passwordResetMinutes * 60 * 1000),
        },
      });
      await recordAudit({
        action: 'auth.password_reset_requested',
        actorId: user.id,
        targetType: 'user',
        targetId: user.id,
        requestId: context.requestId,
      });
      // No transactional email provider is configured in this deployment. In
      // non-production the link is returned to the operator for testing only;
      // production requires an email provider (see docs/deployment.md).
      logger.info('password_reset_token_created', { userId: user.id });
      if (!isProduction) devToken = `${appUrl}/reset-password?token=${token}`;
    }

    return ok(
      {
        message: 'If an account exists for that email, password reset instructions have been generated.',
        ...(devToken ? { developmentResetUrl: devToken } : {}),
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'none', rateLimit: { limit: 6, windowMs: 15 * 60 * 1000, per: 'ip' } },
);
