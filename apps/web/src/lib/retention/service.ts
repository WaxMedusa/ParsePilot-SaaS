import { prisma } from '../prisma';
import { getStorage } from '../storage';
import { retentionConfig } from '../../config/retention';
import { logger } from '../logger';
import { recordAudit } from '../audit';
import { increment, observe } from '../observability/metrics';
import { purgeDocument } from '../documents/service';
import { expireStaleExports } from '../exports/service';

/**
 * Retention service. Runs inside a background job (never an HTTP request),
 * is safe to execute repeatedly, and records every destructive action in the
 * audit trail with its own DeletionRecord where legally appropriate.
 */

export type RetentionSummary = {
  startedAt: string;
  finishedAt: string;
  documentsPurged: number;
  workspacesDeleted: number;
  documentsExpiredFromDeletedWorkspaces: number;
  exportsExpired: number;
  objectsDeleted: number;
  sessionsDeleted: number;
  resetTokensDeleted: number;
  auditEntriesDeleted: number;
  dataExportsCompleted: number;
  accountsDeleted: number;
  deletionRetries: number;
  errors: string[];
};

async function safeDeleteObject(storageKey: string): Promise<boolean> {
  try {
    await getStorage().deleteObject(storageKey);
    return true;
  } catch (error) {
    logger.warn('retention_object_delete_failed', { message: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}

async function purgeSoftDeletedDocuments(summary: RetentionSummary) {
  const due = await prisma.document.findMany({
    where: { deletedAt: { not: null }, purgeAfter: { lte: new Date() } },
    select: { id: true },
    take: 50,
  });
  for (const document of due) {
    try {
      await purgeDocument(document.id);
      summary.documentsPurged += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      summary.errors.push(`document_purge:${document.id}:${message}`);
      logger.error('retention_document_purge_failed', { documentId: document.id, message });
    }
  }
}

async function purgeWorkspace(workspaceId: string): Promise<number> {
  const documents = await prisma.document.findMany({
    where: { workspaceId },
    select: { id: true, storageKey: true },
  });
  let deleted = 0;
  for (const document of documents) {
    const ok = await safeDeleteObject(document.storageKey);
    if (ok) deleted += 1;
  }
  const exports = await prisma.export.findMany({ where: { workspaceId, storageKey: { not: null } }, select: { storageKey: true } });
  for (const entry of exports) {
    if (entry.storageKey && (await safeDeleteObject(entry.storageKey))) deleted += 1;
  }
  await prisma.workspace.delete({ where: { id: workspaceId } });
  return deleted;
}

async function deleteScheduledWorkspaces(summary: RetentionSummary) {
  const due = await prisma.workspace.findMany({
    where: { deletionScheduledAt: { lte: new Date() }, deletedAt: null },
    select: { id: true, ownerId: true, name: true },
    take: 10,
  });
  for (const workspace of due) {
    try {
      await recordAudit({
        action: 'privacy.request_completed',
        workspaceId: workspace.id,
        targetType: 'workspace',
        targetId: workspace.id,
        metadata: { reason: 'scheduled_retention_deletion' },
      });
      const objects = await purgeWorkspace(workspace.id);
      summary.workspacesDeleted += 1;
      summary.objectsDeleted += objects;
      await prisma.dataRequest.updateMany({
        where: { workspaceId: workspace.id, type: 'workspace_deletion', status: { in: ['pending', 'processing'] } },
        data: { status: 'completed', completedAt: new Date() },
      });
    } catch (error) {
      summary.errors.push(`workspace_delete:${workspace.id}`);
      logger.error('retention_workspace_delete_failed', { workspaceId: workspace.id, message: error instanceof Error ? error.message : 'unknown' });
    }
  }
}

async function retryDeletionRecords(summary: RetentionSummary) {
  const pending = await prisma.deletionRecord.findMany({
    where: { status: { in: ['scheduled', 'failed'] }, createdAt: { lt: new Date(Date.now() - 60_000) } },
    take: 50,
  });
  for (const record of pending) {
    if (!record.storageKey) {
      await prisma.deletionRecord.update({ where: { id: record.id }, data: { status: 'completed', completedAt: new Date() } });
      continue;
    }
    const ok = await safeDeleteObject(record.storageKey);
    await prisma.deletionRecord.update({
      where: { id: record.id },
      data: {
        status: ok ? 'completed' : 'failed',
        attempts: { increment: 1 },
        completedAt: ok ? new Date() : null,
        lastError: ok ? null : 'object_delete_failed',
      },
    });
    if (ok) summary.objectsDeleted += 1;
    summary.deletionRetries += 1;
  }
}

async function expireExports(summary: RetentionSummary) {
  summary.exportsExpired += await expireStaleExports();
  const expiredWithObjects = await prisma.export.findMany({
    where: { status: 'expired', storageKey: { not: null } },
    select: { id: true, storageKey: true },
    take: 50,
  });
  for (const entry of expiredWithObjects) {
    if (entry.storageKey && (await safeDeleteObject(entry.storageKey))) {
      summary.objectsDeleted += 1;
    }
    await prisma.export.update({ where: { id: entry.id }, data: { storageKey: null } });
  }
}

async function cleanAuthArtifacts(summary: RetentionSummary) {
  const revokedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: revokedCutoff } }] },
  });
  summary.sessionsDeleted = sessions.count;
  const tokens = await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
  });
  summary.resetTokensDeleted = tokens.count;
  await prisma.emailVerificationToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
  });
  const invitationCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.workspaceInvitation.deleteMany({ where: { expiresAt: { lt: invitationCutoff } } });
  const auditCutoff = new Date(Date.now() - retentionConfig.auditLogDays * 24 * 60 * 60 * 1000);
  const audit = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });
  summary.auditEntriesDeleted = audit.count;
}

async function buildAccountExport(request: { id: string; userId: string; workspaceId: string | null }): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) throw new Error('User not found for export');

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: request.userId },
    select: { role: true, createdAt: true, workspace: { select: { id: true, name: true, slug: true, planCode: true, createdAt: true } } },
  });

  const documents = await prisma.document.findMany({
    where: { uploadedById: request.userId, workspaceId: request.workspaceId ?? undefined },
    select: {
      id: true,
      workspaceId: true,
      originalName: true,
      status: true,
      kind: true,
      pageCount: true,
      sizeBytes: true,
      createdAt: true,
      deletedAt: true,
      extractionRuns: {
        orderBy: { version: 'desc' },
        take: 1,
        select: {
          version: true,
          completedAt: true,
          fields: { select: { fieldKey: true, originalValue: true, normalizedValue: true, editedValue: true, confidence: true } },
        },
      },
    },
  });

  const dataRequests = await prisma.dataRequest.findMany({
    where: { userId: request.userId },
    select: { id: true, type: true, status: true, createdAt: true, completedAt: true },
  });

  const usage = await prisma.usageLedger.findMany({
    where: { workspaceId: request.workspaceId ?? undefined, workspace: { members: { some: { userId: request.userId } } } },
    select: { workspaceId: true, kind: true, quantity: true, reason: true, occurredAt: true },
    take: 5_000,
  });

  const sessions = await prisma.session.findMany({
    where: { userId: request.userId },
    select: { createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true, userAgent: true },
    take: 100,
  });

  const bundle = {
    generatedAt: new Date().toISOString(),
    exportVersion: 1,
    notice:
      'This bundle contains the account data held by ParsePilot as of the generation date. Uploaded document files are not embedded; download each document separately from your workspace before deleting your account. Some billing and audit records are retained for legal and security purposes as described in the Privacy Policy.',
    account: user,
    memberships,
    documents,
    dataRequests,
    usage,
    sessions: sessions.map((session) => ({
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      userAgent: session.userAgent,
    })),
  };

  const storageKey = `data-requests/${request.id}/account-export.json`;
  await getStorage().putObject(storageKey, new TextEncoder().encode(JSON.stringify(bundle, null, 2)), {
    contentType: 'application/json',
  });

  await prisma.dataRequest.update({
    where: { id: request.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      resultStorageKey: storageKey,
      resultExpiresAt: new Date(Date.now() + retentionConfig.dataRequestArtefactDays * 24 * 60 * 60 * 1000),
    },
  });
  await recordAudit({
    action: 'privacy.request_completed',
    workspaceId: request.workspaceId,
    actorId: request.userId,
    targetType: 'data_request',
    targetId: request.id,
    metadata: { type: 'account_export' },
  });
}

async function deleteAccount(request: { id: string; userId: string }): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { id: true, deletionRequestedAt: true },
  });
  if (!user) {
    await prisma.dataRequest.update({ where: { id: request.id }, data: { status: 'rejected', failureReason: 'Account already removed' } });
    return false;
  }
  const graceMs = retentionConfig.accountDeletionGraceDays * 24 * 60 * 60 * 1000;
  const requestedAt = user.deletionRequestedAt?.getTime() ?? 0;
  if (Date.now() - requestedAt < graceMs) return false;

  const owned = await prisma.workspace.findMany({
    where: { ownerId: user.id },
    select: { id: true, _count: { select: { members: true } } },
  });
  const blocked = owned.filter((workspace) => workspace._count.members > 1);
  if (blocked.length > 0) {
    await prisma.dataRequest.update({
      where: { id: request.id },
      data: {
        status: 'rejected',
        failureReason:
          'You own workspaces that still have other members. Transfer ownership or remove the other members, then request deletion again.',
      },
    });
    return false;
  }

  for (const workspace of owned) {
    await purgeWorkspace(workspace.id);
  }
  await prisma.$transaction([
    prisma.dataRequest.update({ where: { id: request.id }, data: { status: 'completed', completedAt: new Date() } }),
    prisma.cookieConsent.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  await recordAudit({
    action: 'privacy.request_completed',
    targetType: 'account',
    targetId: request.id,
    metadata: { accountDeleted: true, workspacesDeleted: owned.length },
  });
  logger.info('account_deleted', { requestId: request.id });
  return true;
}

async function processDataRequests(summary: RetentionSummary) {
  const requests = await prisma.dataRequest.findMany({
    where: { status: { in: ['pending', 'processing'] }, createdAt: { lt: new Date(Date.now() - 30_000) } },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  for (const request of requests) {
    try {
      if (request.type === 'account_export') {
        await buildAccountExport(request);
        summary.dataExportsCompleted += 1;
      } else if (request.type === 'account_deletion') {
        const deleted = await deleteAccount(request);
        if (deleted) summary.accountsDeleted += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      summary.errors.push(`data_request:${request.id}:${message}`);
      await prisma.dataRequest.update({
        where: { id: request.id },
        data: { status: 'failed', failureReason: message.slice(0, 300) },
      });
      logger.error('retention_data_request_failed', { requestId: request.id, message });
    }
  }
}

export async function runRetentionSweep(): Promise<RetentionSummary> {
  const startedAt = new Date();
  const summary: RetentionSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    documentsPurged: 0,
    workspacesDeleted: 0,
    documentsExpiredFromDeletedWorkspaces: 0,
    exportsExpired: 0,
    objectsDeleted: 0,
    sessionsDeleted: 0,
    resetTokensDeleted: 0,
    auditEntriesDeleted: 0,
    dataExportsCompleted: 0,
    accountsDeleted: 0,
    deletionRetries: 0,
    errors: [],
  };

  try {
    await purgeSoftDeletedDocuments(summary);
    await deleteScheduledWorkspaces(summary);
    await expireExports(summary);
    await retryDeletionRecords(summary);
    await cleanAuthArtifacts(summary);
    await processDataRequests(summary);
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : 'unknown');
    logger.error('retention_sweep_failed', { message: error instanceof Error ? error.message : 'unknown' });
  }

  summary.finishedAt = new Date().toISOString();
  await increment('retention_sweeps');
  await observe('retention_sweep_duration', Date.now() - startedAt.getTime());
  await recordAudit({ action: 'retention.sweep', metadata: { ...summary, errors: summary.errors.slice(0, 10) } });
  logger.info('retention_sweep_completed', { ...summary, errors: summary.errors.length });
  return summary;
}
