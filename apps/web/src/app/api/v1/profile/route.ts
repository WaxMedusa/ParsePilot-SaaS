import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { avatarUrl } from '@/lib/profile/avatar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const select = { id: true, email: true, name: true, avatarUpdatedAt: true, emailVerifiedAt: true } as const;

function present(user: { id: string; email: string; name: string | null; avatarUpdatedAt: Date | null; emailVerifiedAt: Date | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.emailVerifiedAt),
    avatarUrl: avatarUrl(user.avatarUpdatedAt),
  };
}

export const GET = withApi(
  async (_request, context) => {
    const user = await prisma.user.findUnique({ where: { id: context.auth!.user.id }, select });
    if (!user) throw ApiError.notFound('Account not found');
    return ok(present(user));
  },
  { auth: 'required', workspace: false },
);

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep the name under 80 characters'),
});

export const PATCH = withApi(
  async (request, context) => {
    const body = patchSchema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id: context.auth!.user.id },
      data: { name: body.name },
      select,
    });
    return ok(present(user));
  },
  { auth: 'required', workspace: false, rateLimit: { limit: 30, windowMs: 60_000, per: 'user' } },
);
