import { prisma } from '@/lib/prisma';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { isProduction } from '@/lib/env';
import { sendEmailVerification } from '@/lib/auth/email-verification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (_request, context) => {
    const user = await prisma.user.findUnique({
      where: { id: context.auth!.user.id },
      select: { id: true, email: true, name: true, emailVerifiedAt: true, disabledAt: true },
    });
    if (!user || user.disabledAt) throw ApiError.unauthorized();
    if (user.emailVerifiedAt) {
      return ok({ verified: true, sent: false, message: 'This email is already verified.' }, { requestId: context.requestId });
    }

    const result = await sendEmailVerification(user);
    if (!result.sent && isProduction) {
      throw ApiError.unavailable('Email delivery is not configured on this deployment. Contact support.');
    }

    return ok(
      {
        sent: result.sent,
        verified: false,
        message: result.sent ? 'Verification email sent.' : 'Verification email could not be sent.',
        ...(result.developmentVerificationUrl
          ? { developmentVerificationUrl: result.developmentVerificationUrl }
          : {}),
      },
      { requestId: context.requestId },
    );
  },
  { workspace: false, rateLimit: { limit: 5, windowMs: 15 * 60 * 1000, per: 'user' } },
);
