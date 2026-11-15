import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { prisma } from '@/lib/prisma';
import { listWorkspacesForUser } from '@/lib/auth/authorization';
import { CSRF_COOKIE } from '@/lib/auth/session';

export const runtime = 'nodejs';

export const GET = withApi(
  async (request, context) => {
    const user = context.auth!.user;
    const [account, workspaces] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, createdAt: true, emailVerifiedAt: true, lastLoginAt: true },
      }),
      listWorkspacesForUser(user.id),
    ]);
    return ok(
      {
        user: account,
        workspaces,
        currentWorkspaceId: context.workspace?.id ?? null,
        csrfToken: request.cookies.get(CSRF_COOKIE)?.value ?? null,
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'required' },
);
