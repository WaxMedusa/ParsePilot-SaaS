import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { appConfig } from '../env';
import { getStorage, generateStorageKey, StorageError } from '../storage';
import { validateUploadFile } from './validation';
import { assertCanProcess, assertUploadSizeAllowed } from '../billing/usage';
import { createJob } from '../jobs/service';
import { recordAudit } from '../audit';
import { logger } from '../logger';
import { increment, observe } from '../observability/metrics';
import { retentionConfig } from '../../config/retention';
import {
  findChecksumDuplicate,
  findDocumentForWorkspace,
  getLatestExtraction,
} from './repository';
import { resolveFieldValue } from './fields';

/**
 * Business logic for documents. Every operation is scoped by workspace and
 * re-checks authorization at the API layer; storage objects are only ever
 * reachable through short-lived signed URLs minted here.
 */

export async function createDocumentFromUpload(input: {
  workspaceId: string;
  userId: string;
  file: File;
  correlationId: string;
  ipHash: string;
}) {
  const startedAt = Date.now();
  await assertUploadSizeAllowed(input.workspaceId, input.file.size);

  const maxBytes = Math.min(appConfig.maxUploadBytes, 100 * 1024 * 1024);
  if (input.file.size > maxBytes) {
    throw ApiError.payloadTooLarge(`Files must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`);
  }
  const arrayBuffer = await input.file.arrayBuffer();
  const validated = await validateUploadFile({
    bytes: new Uint8Array(arrayBuffer),
    filename: input.file.name,
    declaredMime: input.file.type,
    maxBytes,
  });

  // Quota and subscription checks happen before any object is written.
  await assertCanProcess(input.workspaceId, validated.pageCount);

  const storage = getStorage();
  const storageKey = generateStorageKey(input.workspaceId, validated.extension);

  try {
    await storage.putObject(storageKey, validated.bytes, {
      contentType: validated.mime,
      checksumSha256: validated.checksumSha256,
    });
  } catch (error) {
    await increment('upload_storage_failures');
    logger.error('upload_storage_failed', { workspaceId: input.workspaceId, message: error instanceof Error ? error.message : 'unknown' });
    throw ApiError.unavailable('The document could not be stored. Please try again.');
  }

  // Integrity verification: the stored bytes must match the accepted upload.
  if (storage.driver === 'local') {
    const readBack = await storage.getObject(storageKey);
    const digest = createHash('sha256').update(readBack).digest('hex');
    if (digest !== validated.checksumSha256) {
      await storage.deleteObject(storageKey).catch(() => undefined);
      throw ApiError.internal('Stored file failed its integrity check');
    }
  }

  let createdDocumentId: string | null = null;
  try {
    const duplicate = await findChecksumDuplicate(input.workspaceId, validated.checksumSha256);

    const document = await prisma.document.create({
      data: {
        workspaceId: input.workspaceId,
        uploadedById: input.userId,
        originalName: validated.originalName,
        storageKey,
        mimeType: validated.mime,
        detectedMimeType: validated.mime,
        sizeBytes: validated.sizeBytes,
        checksumSha256: validated.checksumSha256,
        pageCount: validated.pageCount,
        status: 'uploaded',
        kind: 'unknown',
        duplicateOfId: duplicate?.id ?? null,
        duplicateScore: duplicate ? 1 : null,
        metadata: {
          declaredMime: input.file.type || null,
          quarantined: false,
        } as Prisma.InputJsonValue,
      },
    });
    createdDocumentId = document.id;

    const job = await createJob({
      workspaceId: input.workspaceId,
      type: 'document_process',
      documentId: document.id,
      idempotencyKey: `doc:${document.id}:initial`,
      correlationId: input.correlationId,
      onActiveConflict: 'return_existing',
    });

    await prisma.document.update({ where: { id: document.id }, data: { status: 'queued' } });

    await recordAudit({
      action: 'document.uploaded',
      workspaceId: input.workspaceId,
      actorId: input.userId,
      targetType: 'document',
      targetId: document.id,
      ipHash: input.ipHash,
      requestId: input.correlationId,
      metadata: { sizeBytes: validated.sizeBytes, mime: validated.mime, pages: validated.pageCount },
    });
    await increment('documents_uploaded');
    await observe('upload_duration', Date.now() - startedAt);

    return { document, job, duplicate: duplicate ?? null };
  } catch (error) {
    // Never leave an orphaned object if the database write fails.
    await getStorage().deleteObject(storageKey).catch(() => undefined);
    if (createdDocumentId) {
      await prisma.document.delete({ where: { id: createdDocumentId } }).catch(() => undefined);
    }
    throw error;
  }
}

export async function getDocumentDetail(documentId: string, workspaceId: string) {
  const document = await findDocumentForWorkspace(documentId, workspaceId);
  const latestRun = document.extractionRuns[0] ?? null;
  const runWarnings = Array.isArray((latestRun?.rawPayload as { warnings?: unknown } | null)?.warnings)
    ? ((latestRun?.rawPayload as { warnings: unknown[] }).warnings ?? []).filter(
        (warning): warning is string => typeof warning === 'string',
      )
    : [];

  return {
    id: document.id,
    originalName: document.originalName,
    status: document.status,
    kind: document.kind,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    pageCount: document.pageCount,
    checksumSha256: document.checksumSha256,
    duplicateOfId: document.duplicateOfId,
    duplicateScore: document.duplicateScore,
    failureCode: document.failureCode,
    failureMessage: document.failureMessage,
    metadata: document.metadata,
    language: document.language,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    uploadedBy: document.uploadedBy,
    jobs: document.jobs.map((job) => ({
      id: job.id,
      status: job.status,
      stage: job.stage,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    })),
    extraction: latestRun
      ? {
          id: latestRun.id,
          version: latestRun.version,
          provider: latestRun.provider,
          model: latestRun.model,
          warnings: runWarnings,
          ocrUsed: latestRun.ocrUsed,
          pagesProcessed: latestRun.pagesProcessed,
          completedAt: latestRun.completedAt?.toISOString() ?? null,
          fields: latestRun.fields.map((field) => ({
            id: field.id,
            key: field.fieldKey,
            value: resolveFieldValue(field),
            originalValue: field.originalValue,
            normalizedValue: field.normalizedValue,
            editedValue: field.editedValue,
            confidence: field.confidence,
            valueType: field.valueType,
            editedAt: field.editedAt?.toISOString() ?? null,
          })),
        }
      : null,
  };
}

export async function markDocumentReviewed(input: {
  documentId: string;
  workspaceId: string;
  actorId: string;
}) {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, workspaceId: input.workspaceId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!document) throw ApiError.notFound('Document not found');
  if (document.status !== 'needs_review') {
    throw ApiError.conflict('Only documents awaiting review can be marked reviewed');
  }

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: { status: 'completed' },
    select: { id: true, status: true },
  });
  await recordAudit({
    action: 'document.reviewed',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'document',
    targetId: document.id,
    metadata: { previousStatus: document.status },
  });
  logger.info('document_reviewed', { documentId: document.id, workspaceId: input.workspaceId });
  return updated;
}

export async function updateDocument(input: {
  documentId: string;
  workspaceId: string;
  actorId: string;
  data: { originalName?: string; kind?: string };
}) {
  await findDocumentForWorkspace(input.documentId, input.workspaceId);
  const updated = await prisma.document.update({
    where: { id: input.documentId },
    data: {
      ...(input.data.originalName ? { originalName: input.data.originalName.slice(0, 180) } : {}),
      ...(input.data.kind ? { kind: input.data.kind as never } : {}),
    },
  });
  await recordAudit({
    action: 'document.updated',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'document',
    targetId: input.documentId,
    metadata: { fields: Object.keys(input.data) },
  });
  return { id: updated.id, originalName: updated.originalName, kind: updated.kind, status: updated.status };
}

/**
 * Soft-deletes a document immediately (access revoked) and schedules the
 * storage object and extraction data for purge by the retention sweep.
 */
export async function deleteDocument(input: { documentId: string; workspaceId: string; actorId: string }) {
  const document = await findDocumentForWorkspace(input.documentId, input.workspaceId);
  const purgeAfter = new Date(Date.now() + retentionConfig.softDeletedDocumentDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.document.update({
      where: { id: document.id },
      data: { deletedAt: new Date(), purgeAfter, status: 'failed', failureMessage: 'Document deleted by user' },
    }),
    prisma.processingJob.updateMany({
      where: { documentId: document.id, status: { in: ['queued', 'running'] } },
      data: { status: 'cancelled', activeKey: null, finishedAt: new Date() },
    }),
    prisma.deletionRecord.create({
      data: {
        workspaceId: input.workspaceId,
        documentId: document.id,
        target: 'document',
        targetId: document.id,
        storageKey: document.storageKey,
        status: 'scheduled',
      },
    }),
  ]);

  await recordAudit({
    action: 'document.deleted',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'document',
    targetId: document.id,
    metadata: { purgeAfter: purgeAfter.toISOString() },
  });
  logger.info('document_soft_deleted', { documentId: document.id, purgeAfter: purgeAfter.toISOString() });
  return { id: document.id, purgeAfter: purgeAfter.toISOString() };
}

/** Immediately purges a document and its object (used by retention + privacy flows). */
export async function purgeDocument(documentId: string): Promise<{ storageDeleted: boolean }> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, storageKey: true, workspaceId: true },
  });
  if (!document) return { storageDeleted: false };

  let storageDeleted = false;
  try {
    await getStorage().deleteObject(document.storageKey);
    storageDeleted = true;
  } catch (error) {
    if (error instanceof StorageError) {
      logger.warn('document_object_delete_failed', { documentId, message: error.message });
    }
  }

  await prisma.$transaction([
    prisma.deletionRecord.create({
      data: {
        workspaceId: document.workspaceId,
        documentId: document.id,
        target: 'document',
        targetId: document.id,
        storageKey: document.storageKey,
        status: storageDeleted ? 'completed' : 'failed',
        completedAt: storageDeleted ? new Date() : null,
        lastError: storageDeleted ? null : 'object_delete_failed',
      },
    }),
    prisma.document.delete({ where: { id: document.id } }),
  ]);
  await recordAudit({
    action: 'document.purged',
    workspaceId: document.workspaceId,
    targetType: 'document',
    targetId: document.id,
    metadata: { storageDeleted },
  });
  return { storageDeleted };
}

/** Creates a short-lived signed download URL after re-checking authorization. */
export async function createDocumentDownloadUrl(input: {
  documentId: string;
  workspaceId: string;
  actorId: string;
}) {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, workspaceId: input.workspaceId, deletedAt: null },
    select: { id: true, storageKey: true, originalName: true, mimeType: true },
  });
  if (!document) throw ApiError.notFound('Document not found');
  const url = await getStorage().createDownloadUrl(
    document.storageKey,
    retentionConfig.signedUrlSeconds,
    document.originalName,
    document.mimeType,
  );
  await recordAudit({
    action: 'document.download_url_created',
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    targetType: 'document',
    targetId: document.id,
  });
  return { url, expiresInSeconds: retentionConfig.signedUrlSeconds };
}

/** Returns the raw object for the signed file route. */
export async function readStoredObject(storageKey: string) {
  return getStorage().getObject(storageKey);
}

/** Authorized bytes for the authenticated in-app document preview. */
export async function getDocumentPreview(input: { documentId: string; workspaceId: string }) {
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, workspaceId: input.workspaceId, deletedAt: null },
    select: { storageKey: true, originalName: true, mimeType: true },
  });
  if (!document) throw ApiError.notFound('Document not found');
  return {
    bytes: await readStoredObject(document.storageKey),
    originalName: document.originalName,
    mimeType: document.mimeType,
  };
}

export async function getDocumentExtractionForExport(documentId: string, workspaceId: string) {
  await findDocumentForWorkspace(documentId, workspaceId);
  return getLatestExtraction(documentId, workspaceId);
}
