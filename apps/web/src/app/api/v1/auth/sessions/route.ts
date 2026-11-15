import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { listActiveSessions } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const sessions = await listActiveSessions(context.auth!.user.id);
    return ok(
      sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        current: session.id === context.auth!.sessionId,
      })),
      { requestId: context.requestId },
    );
  },
  { auth: 'required' },
);
