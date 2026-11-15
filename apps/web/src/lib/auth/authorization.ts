import { prisma } from '../prisma';
import { ApiError } from '../http/errors';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type WorkspaceAccess = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  planCode: string;
};

export const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceAccess[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { deletedAt: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      workspace: { select: { id: true, name: true, slug: true, planCode: true } },
    },
  });
  return memberships.map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    planCode: membership.workspace.planCode,
    role: membership.role as WorkspaceRole,
  }));
}

/**
 * Verifies workspace membership server-side. Workspace IDs supplied by the
 * client are never trusted without this check.
 */
export async function resolveWorkspaceAccess(
  userId: string,
  workspaceId: string,
  minimumRole: WorkspaceRole = 'viewer',
): Promise<WorkspaceAccess> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId, workspace: { deletedAt: null } },
    select: {
      role: true,
      workspace: { select: { id: true, name: true, slug: true, planCode: true } },
    },
  });
  if (!membership) throw ApiError.forbidden('You do not have access to this workspace');
  const role = membership.role as WorkspaceRole;
  if (!roleAtLeast(role, minimumRole)) {
    throw ApiError.forbidden('Your role does not permit this action');
  }
  return {
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    planCode: membership.workspace.planCode,
    role,
  };
}

export async function resolveDefaultWorkspace(userId: string): Promise<WorkspaceAccess | null> {
  const workspaces = await listWorkspacesForUser(userId);
  return workspaces[0] ?? null;
}

/** Requires an owner or admin role for destructive workspace operations. */
export async function assertWorkspaceAdmin(userId: string, workspaceId: string): Promise<WorkspaceAccess> {
  return resolveWorkspaceAccess(userId, workspaceId, 'admin');
}
