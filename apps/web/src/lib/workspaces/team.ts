import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { hashToken } from '../auth/session';
import { appUrl } from '../env';
import { retentionConfig } from '../../config/retention';
import { recordAudit } from '../audit';
import { sendTransactionalEmail } from '../email/service';
import { workspaceInvitationEmail } from '../email/templates';
import type { WorkspaceAccess, WorkspaceRole } from '../auth/authorization';

export const INVITABLE_ROLES = ['admin', 'member', 'viewer'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export type TeamMember = {
  id: string;
  role: WorkspaceRole;
  createdAt: Date;
  userId: string;
  email: string;
  name: string | null;
  lastLoginAt: Date | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: Date;
  expiresAt: Date;
  invitedBy: { name: string | null; email: string };
};

export type TeamSnapshot = {
  members: TeamMember[];
  invitations: PendingInvitation[];
  maxMembers: number;
  planCode: string;
  ownerId: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function rolesActorCanAssign(actorRole: WorkspaceRole): InvitableRole[] {
  if (actorRole === 'owner') return ['admin', 'member', 'viewer'];
  if (actorRole === 'admin') return ['member', 'viewer'];
  return [];
}

export function canManageMember(
  actor: { id: string; role: WorkspaceRole },
  target: { userId: string; role: WorkspaceRole },
  nextRole?: InvitableRole,
): boolean {
  if (actor.id === target.userId) return false;
  if (target.role === 'owner') return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') {
    if (target.role === 'admin') return false;
    return nextRole !== undefined ? nextRole === 'member' || nextRole === 'viewer' : true;
  }
  return false;
}

async function actorMembership(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!member) throw ApiError.forbidden('You do not have access to this workspace');
  return member;
}

async function workspacePlan(workspaceId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true, name: true, planCode: true, ownerId: true },
  });
  if (!workspace) throw ApiError.notFound('Workspace not found');
  const plan = await prisma.plan.findUnique({
    where: { code: workspace.planCode },
    select: { maxMembers: true },
  });
  return { ...workspace, maxMembers: Math.max(1, plan?.maxMembers ?? 2) };
}

async function seatUsage(workspaceId: string) {
  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.workspaceInvitation.count({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  return members + invitations;
}

export async function getTeamSnapshot(workspaceId: string): Promise<TeamSnapshot> {
  const [members, invitations, workspace] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        role: true,
        createdAt: true,
        userId: true,
        user: { select: { email: true, name: true, lastLoginAt: true } },
      },
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        invitedBy: { select: { name: true, email: true } },
      },
    }),
    workspacePlan(workspaceId),
  ]);

  return {
    members: members.map((member) => ({
      id: member.id,
      role: member.role as WorkspaceRole,
      createdAt: member.createdAt,
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      lastLoginAt: member.user.lastLoginAt,
    })),
    invitations: invitations.map((invitation) => ({
      ...invitation,
      role: invitation.role as WorkspaceRole,
    })),
    maxMembers: workspace.maxMembers,
    planCode: workspace.planCode,
    ownerId: workspace.ownerId,
  };
}

export async function inviteTeamMember(input: {
  workspaceId: string;
  actorId: string;
  email: string;
  role: InvitableRole;
}) {
  const actor = await actorMembership(input.workspaceId, input.actorId);
  const actorRole = actor.role as WorkspaceRole;
  if (!rolesActorCanAssign(actorRole).includes(input.role)) {
    throw ApiError.forbidden('Your role cannot invite a member with that role');
  }

  const email = normalizeEmail(input.email);
  const [workspace, existingUser, existingInvitation] = await Promise.all([
    workspacePlan(input.workspaceId),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.workspaceInvitation.findFirst({
      where: { workspaceId: input.workspaceId, email, acceptedAt: null, revokedAt: null },
      select: { id: true },
    }),
  ]);

  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: existingUser.id } },
      select: { id: true },
    });
    if (existingMember) throw ApiError.conflict('That person is already a member of this workspace');
  }

  if (existingInvitation) {
    await prisma.workspaceInvitation.update({
      where: { id: existingInvitation.id },
      data: { revokedAt: new Date() },
    });
  }

  const seats = await seatUsage(input.workspaceId);
  if (seats + 1 > workspace.maxMembers) {
    throw ApiError.quotaExceeded(
      `This workspace has ${workspace.maxMembers} seats on the ${workspace.planCode} plan. Remove a pending invitation or upgrade before inviting another person.`,
      { maxMembers: workspace.maxMembers, seatsUsed: seats },
    );
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + retentionConfig.invitationDays * 24 * 60 * 60 * 1000);
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: input.workspaceId,
      invitedById: input.actorId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      expiresAt,
    },
    select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
  });

  const inviteUrl = `${appUrl}/invite/${encodeURIComponent(token)}`;
  const message = workspaceInvitationEmail({
    workspaceName: workspace.name,
    inviterName: actor.user.name,
    inviteeEmail: email,
    role: input.role,
    inviteUrl,
    expiresDays: retentionConfig.invitationDays,
  });
  const delivery = await sendTransactionalEmail({ to: email, ...message });

  await recordAudit({
    action: 'workspace.invitation_sent',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'workspace_invitation',
    targetId: invitation.id,
    metadata: { role: input.role, emailSent: delivery.sent },
  });

  return {
    invitation: { ...invitation, role: invitation.role as WorkspaceRole },
    inviteUrl,
    emailSent: delivery.sent,
  };
}

export async function revokeTeamInvitation(input: {
  workspaceId: string;
  actorId: string;
  invitationId: string;
}) {
  const actor = await actorMembership(input.workspaceId, input.actorId);
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw ApiError.forbidden('Only workspace owners and admins can revoke invitations');
  }
  const invitation = await prisma.workspaceInvitation.findFirst({
    where: { id: input.invitationId, workspaceId: input.workspaceId, acceptedAt: null, revokedAt: null },
    select: { id: true },
  });
  if (!invitation) throw ApiError.notFound('Invitation not found');
  await prisma.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });
  await recordAudit({
    action: 'workspace.invitation_revoked',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'workspace_invitation',
    targetId: invitation.id,
  });
}

export async function getInvitationPreview(token: string) {
  if (!token || token.length < 20) return null;
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      workspace: { select: { name: true, slug: true, deletedAt: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt.getTime() <= Date.now() ||
    invitation.workspace.deletedAt
  ) {
    return null;
  }
  return {
    email: invitation.email,
    role: invitation.role as WorkspaceRole,
    expiresAt: invitation.expiresAt,
    workspaceName: invitation.workspace.name,
    invitedBy: invitation.invitedBy,
  };
}

export async function acceptInvitation(input: {
  userId: string;
  userEmail: string;
  token: string;
}): Promise<WorkspaceAccess> {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      workspace: { select: { id: true, name: true, slug: true, planCode: true, deletedAt: true } },
    },
  });
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt.getTime() <= Date.now() ||
    invitation.workspace.deletedAt
  ) {
    throw ApiError.badRequest('This invitation is invalid or has expired');
  }
  if (normalizeEmail(input.userEmail) !== normalizeEmail(invitation.email)) {
    throw ApiError.forbidden(`This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`);
  }

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: input.userId } },
    select: { role: true },
  });
  if (existing) {
    await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    return {
      id: invitation.workspace.id,
      name: invitation.workspace.name,
      slug: invitation.workspace.slug,
      planCode: invitation.workspace.planCode,
      role: existing.role as WorkspaceRole,
    };
  }

  const workspace = await workspacePlan(invitation.workspaceId);
  const members = await prisma.workspaceMember.count({ where: { workspaceId: invitation.workspaceId } });
  if (members + 1 > workspace.maxMembers) {
    throw ApiError.quotaExceeded('This workspace has no seats available. Ask an owner to upgrade the plan.');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: { workspaceId: invitation.workspaceId, userId: input.userId, role: invitation.role },
    }),
    prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: now } }),
  ]);
  await recordAudit({
    action: 'workspace.invitation_accepted',
    workspaceId: invitation.workspaceId,
    actorId: input.userId,
    targetType: 'workspace_invitation',
    targetId: invitation.id,
    metadata: { role: invitation.role },
  });

  return {
    id: invitation.workspace.id,
    name: invitation.workspace.name,
    slug: invitation.workspace.slug,
    planCode: invitation.workspace.planCode,
    role: invitation.role as WorkspaceRole,
  };
}

export async function updateMemberRole(input: {
  workspaceId: string;
  actorId: string;
  memberId: string;
  role: InvitableRole;
}) {
  const actor = await actorMembership(input.workspaceId, input.actorId);
  const target = await prisma.workspaceMember.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true, userId: true, role: true },
  });
  if (!target) throw ApiError.notFound('Member not found');
  if (!canManageMember(
    { id: actor.user.id, role: actor.role as WorkspaceRole },
    { userId: target.userId, role: target.role as WorkspaceRole },
    input.role,
  )) {
    throw ApiError.forbidden('Your role cannot change that member');
  }
  await prisma.workspaceMember.update({ where: { id: target.id }, data: { role: input.role } });
  await recordAudit({
    action: 'workspace.member_role_changed',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'workspace_member',
    targetId: target.id,
    metadata: { role: input.role },
  });
}

export async function removeTeamMember(input: {
  workspaceId: string;
  actorId: string;
  memberId: string;
}) {
  const actor = await actorMembership(input.workspaceId, input.actorId);
  const target = await prisma.workspaceMember.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true, userId: true, role: true },
  });
  if (!target) throw ApiError.notFound('Member not found');
  if (!canManageMember(
    { id: actor.user.id, role: actor.role as WorkspaceRole },
    { userId: target.userId, role: target.role as WorkspaceRole },
  )) {
    throw ApiError.forbidden('Your role cannot remove that member');
  }
  await prisma.workspaceMember.delete({ where: { id: target.id } });
  await recordAudit({
    action: 'workspace.member_removed',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'workspace_member',
    targetId: target.id,
  });
}
