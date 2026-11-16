import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { prisma } from '../prisma';
import { isProduction } from '../env';
import { retentionConfig } from '../../config/retention';

export const SESSION_COOKIE = 'pp_session';
export const CSRF_COOKIE = 'pp_csrf';

export type SessionUser = { id: string; email: string; name: string | null; emailVerifiedAt: Date | null };

export type ResolvedSession = { sessionId: string; user: SessionUser; expiresAt: Date };

export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ipHash?: string; expiresInDays?: number },
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const { token, tokenHash } = generateSessionToken();
  const days = meta.expiresInDays ?? retentionConfig.sessionDays;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipHash: meta.ipHash ?? null,
    },
    select: { id: true },
  });
  return { token, sessionId: session.id, expiresAt };
}

/** Resolves a session token, rejecting expired, revoked or disabled accounts. */
export async function resolveSessionToken(token: string): Promise<ResolvedSession | null> {
  if (!token || token.length < 20) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      user: { select: { id: true, email: true, name: true, emailVerifiedAt: true, disabledAt: true } },
    },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.disabledAt) return null;

  // Throttled last-used update (at most once per 10 minutes).
  if (Date.now() - session.lastUsedAt.getTime() > 10 * 60 * 1000) {
    prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerifiedAt: session.user.emailVerifiedAt,
    },
  };
}

export async function readSessionToken(request?: NextRequest): Promise<string | null> {
  const authorization = request?.headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const bearer = authorization.slice(7).trim();
    if (bearer) return bearer;
  }
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true, ipHash: true },
  });
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
};

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...cookieOptions, expires: new Date(0) });
}
