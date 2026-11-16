import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { recordAudit } from '@/lib/audit';
import { confirmEmailVerification } from '@/lib/auth/email-verification';

export const runtime = 'nodejs';

const schema = z.object({ token: z.string().min(20).max(200) });

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    try {
      const result = await confirmEmailVerification(body.token);
      await recordAudit({
        action: 'auth.email_verified',
        actorId: result.userId,
        targetType: 'user',
        targetId: result.userId,
        requestId: context.requestId,
      });
      return ok({ verified: true, email: result.email }, { requestId: context.requestId });
    } catch (error) {
      if (error instanceof Error && error.message === 'invalid_verification_token') {
        throw ApiError.badRequest('This verification link is invalid or has expired');
      }
      throw error;
    }
  },
  { auth: 'none', rateLimit: { limit: 10, windowMs: 15 * 60 * 1000, per: 'ip' } },
);
