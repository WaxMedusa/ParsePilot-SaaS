import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { hashPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { verifySupabaseAccessToken } from '@/lib/auth/supabase';
import { createWorkspaceForUser } from '@/lib/workspaces/service';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const userSelect = {
  id: true,
  email: true,
  name: true,
  emailVerifiedAt: true,
  disabledAt: true,
} as const;

/**
 * Exchanges a verified Supabase Google identity for ParsePilot's own session.
 * Supabase is the identity broker; PostgreSQL remains authoritative for users,
 * workspaces and permissions. No service_role key is used here.
 */
export const POST = withApi(
  async (request, context) => {
    const authorization = request.headers.get('authorization') ?? '';
    const accessToken = authorization.toLowerCase().startsWith('bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!accessToken) throw ApiError.unauthorized('Google sign-in token is missing');

    const identity = await verifySupabaseAccessToken(accessToken);
    if (!identity) throw ApiError.unauthorized('Google sign-in could not be verified');

    let user = await prisma.user.findUnique({
      where: { email: identity.email },
      select: userSelect,
    });
    let created = false;

    if (user?.disabledAt) {
      throw ApiError.forbidden('This account is disabled');
    }

    if (!user) {
      // Supabase-only accounts have no ParsePilot password. A random local
      // password keeps the existing schema intact without creating a known
      // password that could be used to bypass the identity provider.
      const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
      try {
        user = await prisma.user.create({
          data: {
            email: identity.email,
            name: identity.name,
            passwordHash,
            emailVerifiedAt: new Date(),
          },
          select: userSelect,
        });
        created = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        user = await prisma.user.findUnique({
          where: { email: identity.email },
          select: userSelect,
        });
      }
    }

    if (!user) throw ApiError.internal();
    if (user.disabledAt) throw ApiError.forbidden('This account is disabled');

    if (!created) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          name: user.name ?? identity.name,
        },
      });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspace: { deletedAt: null } },
      select: { id: true },
    });
    if (!membership) {
      await createWorkspaceForUser({
        name: `${identity.name.split(/\s+/)[0] ?? 'My'}'s workspace`,
        userId: user.id,
        billingEmail: user.email,
      });
    }

    const session = await createSession(user.id, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipHash: context.ipHash,
    });
    await setSessionCookie(session.token, session.expiresAt);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await recordAudit({
      action: created ? 'auth.signup' : 'auth.login',
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      metadata: { provider: 'supabase_google', supabaseUserId: identity.id },
      ipHash: context.ipHash,
      requestId: context.requestId,
    });

    return ok(
      {
        user: { id: user.id, email: user.email, name: user.name },
        sessionExpiresAt: session.expiresAt.toISOString(),
      },
      { requestId: context.requestId, headers: { 'Cache-Control': 'no-store' } },
    );
  },
  { auth: 'none', csrf: false, rateLimit: { limit: 20, windowMs: 5 * 60 * 1000, per: 'ip' } },
);
