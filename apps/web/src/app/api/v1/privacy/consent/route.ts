import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { prisma } from '@/lib/prisma';
import { legalConfig } from '@/config/legal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  anonymousId: z.string().max(80).optional(),
});

/**
 * Essential and authentication cookies do not require consent. Optional
 * analytics and marketing categories are recorded here, and the client also
 * stores the choice so anonymous visitors keep it across visits.
 */
export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const preferences = {
      essential: true,
      authentication: true,
      analytics: body.analytics,
      marketing: body.marketing,
      decidedAt: new Date().toISOString(),
    };
    if (context.auth) {
      await prisma.cookieConsent.upsert({
        where: { userId: context.auth.user.id },
        create: {
          userId: context.auth.user.id,
          preferences,
          policyVersion: legalConfig.versions.cookies.version,
        },
        update: { preferences, policyVersion: legalConfig.versions.cookies.version },
      });
    }
    return ok(
      {
        preferences,
        persisted: context.auth ? 'account' : 'client',
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'optional', rateLimit: { limit: 30, windowMs: 60 * 60 * 1000, per: 'ip' } },
);
