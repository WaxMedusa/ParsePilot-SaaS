import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, resolveSessionToken, type SessionUser } from './session';
import { listWorkspacesForUser, type WorkspaceAccess } from './authorization';

export type ServerAuth = {
  user: SessionUser;
  sessionId: string;
  workspaces: WorkspaceAccess[];
  workspace: WorkspaceAccess | null;
};

export async function getServerAuth(): Promise<ServerAuth | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await resolveSessionToken(token);
  if (!session) return null;
  const workspaces = await listWorkspacesForUser(session.user.id);
  return {
    user: session.user,
    sessionId: session.sessionId,
    workspaces,
    workspace: workspaces[0] ?? null,
  };
}

/** Requires an authenticated session; redirects to sign-in otherwise. */
export async function requireServerAuth(returnTo = '/dashboard'): Promise<ServerAuth> {
  const auth = await getServerAuth();
  if (!auth) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return auth;
}

/** Requires an authenticated session with an available workspace. */
export async function requireWorkspaceAuth(): Promise<ServerAuth & { workspace: WorkspaceAccess }> {
  const auth = await requireServerAuth();
  if (!auth.workspace) redirect('/dashboard/no-workspace');
  return { ...auth, workspace: auth.workspace };
}
