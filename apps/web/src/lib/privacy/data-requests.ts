import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { recordAudit } from '../audit';
import { retentionConfig } from '../../config/retention';
import { verifyPassword } from '../auth/password';
import { revokeAllUserSessions } from '../auth/session';
import { logger } from '../logger';

/**
 * Privacy workflows. Requests are durable database records with explicit
 * statuses; deletion executes after a documented grace period through the
 * retention worker, never synchronously inside the request.
 */

export async function createAccountExportRequest(userId: string, workspaceId: string | null) {
  const pending = await prisma.dataRequest.findFirst({
    where: { userId, type: 'account_export', status: { in: ['pending', 'processing'] } },
  });
  if (pending) throw ApiError.conflict('An account export is already being prepared', { requestId: pending.id });

  const request = await prisma.dataRequest.create({
    data: { userId, workspaceId, type: 'account_export', status: 'pending' },
  });
  await recordAudit({ action: 'privacy.data_export_requested', workspaceId, actorId: userId, targetType: 'data_request', targetId: request.id });
  return request;
}

export async function createWorkspaceExportRequest(userId: string, workspaceId: string) {
  const pending = await prisma.dataRequest.findFirst({
    where: { userId, workspaceId, type: 'account_export', status: { in: ['pending', 'processing'] } },
  });
  if (pending) throw ApiError.conflict('A data export is already being prepared', { requestId: pending.id });
  const request = await prisma.dataRequest.create({
    data: { userId, workspaceId, type: 'account_export', status: 'pending', notes: 'Workspace data export' },
  });
  await recordAudit({ action: 'privacy.data_export_requested', workspaceId, actorId: userId, targetType: 'data_request', targetId: request.id });
  return request;
}

/**
 * Account deletion requires re-authentication and explicit confirmation.
 * Owned workspaces with other members must be transferred first; shared
 * workspaces simply lose this membership.
 */
export async function requestAccountDeletion(input: {
  userId: string;
  password: string;
  confirmation: string;
  deleteWorkspaces: boolean;
}) {
  if (input.confirmation.trim().toUpperCase() !== 'DELETE') {
    throw ApiError.validation([{ path: 'confirmation', message: 'Type DELETE to confirm' }]);
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { passwordHash: true, email: true } });
  if (!user) throw ApiError.notFound('Account not found');
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw ApiError.forbidden('Password confirmation failed');

  const ownedWorkspaces = await prisma.workspace.findMany({
    where: { ownerId: input.userId, deletedAt: null },
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  const sharedOwned = ownedWorkspaces.filter((workspace) => workspace._count.members > 1);
  if (!input.deleteWorkspaces) {
    throw ApiError.badRequest('Confirm deletion of the workspaces you own, or transfer ownership first');
  }

  const existing = await prisma.dataRequest.findFirst({
    where: { userId: input.userId, type: 'account_deletion', status: { in: ['pending', 'processing'] } },
  });
  if (existing) return existing;

  const graceEnd = new Date(Date.now() + retentionConfig.accountDeletionGraceDays * 24 * 60 * 60 * 1000);
  const request = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: input.userId }, data: { deletionRequestedAt: new Date() } });
    await tx.workspace.updateMany({
      where: { ownerId: input.userId, deletedAt: null },
      data: { deletionScheduledAt: graceEnd },
    });
    return tx.dataRequest.create({
      data: {
        userId: input.userId,
        type: 'account_deletion',
        status: 'pending',
        notes: `Scheduled for ${graceEnd.toISOString()}; owns ${ownedWorkspaces.length} workspace(s), ${sharedOwned.length} with other members`,
      },
    });
  });

  await revokeAllUserSessions(input.userId);
  await recordAudit({
    action: 'privacy.account_deletion_requested',
    actorId: input.userId,
    targetType: 'data_request',
    targetId: request.id,
    metadata: { graceEnd: graceEnd.toISOString(), ownedWorkspaces: ownedWorkspaces.length },
  });
  logger.info('account_deletion_requested', { userId: input.userId, requestId: request.id });
  return { ...request, graceEndsAt: graceEnd.toISOString() };
}

export async function cancelAccountDeletion(userId: string) {
  const pending = await prisma.dataRequest.findFirst({
    where: { userId, type: 'account_deletion', status: { in: ['pending', 'processing'] } },
  });
  if (!pending) throw ApiError.notFound('No pending account deletion request');

  await prisma.$transaction([
    prisma.dataRequest.update({
      where: { id: pending.id },
      data: { status: 'cancelled', notes: `${pending.notes ?? ''}\nCancelled by user at ${new Date().toISOString()}` },
    }),
    prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: null } }),
    prisma.workspace.updateMany({
      where: { ownerId: userId, deletedAt: null },
      data: { deletionScheduledAt: null },
    }),
  ]);
  await recordAudit({ action: 'privacy.account_deletion_cancelled', actorId: userId, targetType: 'data_request', targetId: pending.id });
  return { cancelled: true };
}

export async function requestWorkspaceDeletion(input: { workspaceId: string; userId: string; confirmation: string }) {
  if (input.confirmation.trim().toUpperCase() !== 'DELETE WORKSPACE') {
    throw ApiError.validation([{ path: 'confirmation', message: 'Type DELETE WORKSPACE to confirm' }]);
  }
  const workspace = await prisma.workspace.findFirst({
    where: { id: input.workspaceId, ownerId: input.userId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!workspace) throw ApiError.forbidden('Only the workspace owner can delete a workspace');

  const existing = await prisma.dataRequest.findFirst({
    where: { workspaceId: input.workspaceId, type: 'workspace_deletion', status: { in: ['pending', 'processing'] } },
  });
  if (existing) return existing;

  const graceEnd = new Date(Date.now() + retentionConfig.accountDeletionGraceDays * 24 * 60 * 60 * 1000);
  const request = await prisma.$transaction(async (tx) => {
    await tx.workspace.update({ where: { id: input.workspaceId }, data: { deletionScheduledAt: graceEnd } });
    return tx.dataRequest.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        type: 'workspace_deletion',
        status: 'pending',
        notes: `Workspace deletion scheduled for ${graceEnd.toISOString()}`,
      },
    });
  });
  await recordAudit({
    action: 'privacy.workspace_deletion_requested',
    workspaceId: input.workspaceId,
    actorId: input.userId,
    targetType: 'data_request',
    targetId: request.id,
    metadata: { graceEnd: graceEnd.toISOString() },
  });
  return { ...request, graceEndsAt: graceEnd.toISOString() };
}

export async function listDataRequests(userId: string) {
  return prisma.dataRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      status: true,
      notes: true,
      createdAt: true,
      completedAt: true,
      failureReason: true,
      resultExpiresAt: true,
      documentId: true,
      workspaceId: true,
    },
  });
}

export async function getDataRequestDownload(userId: string, requestId: string) {
  const request = await prisma.dataRequest.findFirst({ where: { id: requestId, userId } });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'completed' || !request.resultStorageKey) {
    throw ApiError.conflict('This data request is not ready');
  }
  if (request.resultExpiresAt && request.resultExpiresAt.getTime() <= Date.now()) {
    throw ApiError.conflict('This data export has expired');
  }
  const { getStorage } = await import('../storage');
  const { retentionConfig } = await import('../../config/retention');
  const url = await getStorage().createDownloadUrl(request.resultStorageKey, retentionConfig.signedUrlSeconds, `parsepilot-data-export-${request.id}.json`, 'application/json');
  return { url, expiresInSeconds: retentionConfig.signedUrlSeconds };
}
