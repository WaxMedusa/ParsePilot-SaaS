import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { prisma } from '@/lib/prisma';
import { listActiveSessions } from '@/lib/auth/session';
import { listDataRequests } from '@/lib/privacy/data-requests';
import { listWorkspacesForUser } from '@/lib/auth/authorization';
import { retentionSummary } from '@/config/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const userId = context.auth!.user.id;
    const [account, sessions, requests, workspaces] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true, lastLoginAt: true, deletionRequestedAt: true },
      }),
      listActiveSessions(userId),
      listDataRequests(userId),
      listWorkspacesForUser(userId),
    ]);

    return ok(
      {
        account,
        sessions: sessions.map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          lastUsedAt: session.lastUsedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          current: session.id === context.auth!.sessionId,
        })),
        requests: requests.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString(),
          completedAt: entry.completedAt?.toISOString() ?? null,
          resultExpiresAt: entry.resultExpiresAt?.toISOString() ?? null,
        })),
        workspaces,
        retention: retentionSummary,
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'required' },
);
