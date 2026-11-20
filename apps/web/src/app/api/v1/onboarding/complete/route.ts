import { prisma } from '@/lib/prisma';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (_request, context) => {
    await prisma.user.update({
      where: { id: context.auth!.user.id },
      data: { onboardedAt: new Date() },
    });
    return ok({ onboarded: true }, { requestId: context.requestId, headers: { 'Cache-Control': 'no-store' } });
  },
  { auth: 'required', workspace: false, rateLimit: { limit: 10, windowMs: 60_000, per: 'user' } },
);
