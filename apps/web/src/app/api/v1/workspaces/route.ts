import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { listWorkspacesForUser } from '@/lib/auth/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const workspaces = await listWorkspacesForUser(context.auth!.user.id);
    return ok(workspaces, { requestId: context.requestId });
  },
  { auth: 'required' },
);
