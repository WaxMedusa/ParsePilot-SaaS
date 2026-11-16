import { cookies } from 'next/headers';
import { isProduction } from '../env';

export const WORKSPACE_COOKIE = 'pp_workspace';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};

export async function setWorkspaceCookie(workspaceId: string): Promise<void> {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId, cookieOptions);
}

export async function clearWorkspaceCookie(): Promise<void> {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}
