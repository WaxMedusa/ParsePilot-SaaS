import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { recordAudit } from '../audit';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) || 'workspace';
}

export async function createWorkspaceForUser(input: { name: string; userId: string; billingEmail?: string | null }) {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) throw ApiError.validation([{ path: 'workspaceName', message: 'Workspace name is too short' }]);

  const base = slugify(name);
  let slug = base;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) break;
    slug = `${base}-${randomBytes(3).toString('hex')}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      ownerId: input.userId,
      billingEmail: input.billingEmail ?? null,
      planCode: 'free',
      members: { create: { userId: input.userId, role: 'owner' } },
      subscription: { create: { planCode: 'free', status: 'active' } },
    },
    select: { id: true, name: true, slug: true, planCode: true },
  });

  await recordAudit({
    action: 'workspace.created',
    workspaceId: workspace.id,
    actorId: input.userId,
    targetType: 'workspace',
    targetId: workspace.id,
  });
  return workspace;
}

export async function listWorkspaceMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, lastLoginAt: true } },
    },
  });
}

export async function renameWorkspace(workspaceId: string, actorId: string, name: string) {
  const trimmed = name.trim().slice(0, 80);
  if (trimmed.length < 2) throw ApiError.validation([{ path: 'name', message: 'Workspace name is too short' }]);
  const updated = await prisma.workspace.update({ where: { id: workspaceId }, data: { name: trimmed } });
  await recordAudit({
    action: 'workspace.created',
    workspaceId,
    actorId,
    targetType: 'workspace',
    targetId: workspaceId,
    metadata: { renamed: true },
  });
  return updated;
}
