import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { appConfig } from '../env';
import { getStorage, generateStorageKey, StorageError, type StorageProvider } from '../storage';
import { deleteObjectIfUnreferenced, getStorageForKey } from '../storage/references';
import { extensionForMime, validateUploadFile, type ValidatedUpload } from './validation';
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

/**
 * Chooses where a new document's bytes go. A connected Google Drive takes
 * them (the user's own quota); otherwise the deployment's storage does.
 */
async function resolveUploadTarget(userId: string, workspaceId: string, extension: string) {
  // The table may not exist on a deployment that has not migrated yet; that is
  // not a reason to reject an upload.
  const connection = await Promise.resolve()
    .then(() => prisma.storageConnection.findUnique({ where: { userId }, select: { id: true } }))
    .catch(() => null);

  if (connection) {
    const [{ GoogleDriveStorage, driveStorageKey }, { reserveDriveFileId }] = await Promise.all([
      import('../storage/google-drive'),
      import('../integrations/google-drive'),
    ]);
    const fileId = await reserveDriveFileId(userId).catch(() => null);
    if (fileId) {
      return {
        storage: new GoogleDriveStorage(userId) as StorageProvider,
        storageKey: driveStorageKey(userId, fileId, extension),
      };
    }
    logger.warn('drive_id_reservation_failed', { userId });
  }

  return { storage: getStorage(), storageKey: generateStorageKey(workspaceId, extension) };
}

/** Writes the accepted bytes, falling back to deployment storage if Drive fails. */
async function storeUpload(input: {
  userId: string;
  workspaceId: string;
  extension: string;
  bytes: Uint8Array;
  mime: string;
  checksumSha256: string;
}): Promise<{ storageKey: string; driver: StorageProvider['driver'] }> {
  const target = await resolveUploadTarget(input.userId, input.workspaceId, input.extension);

  try {
    await target.storage.putObject(target.storageKey, input.bytes, {
      contentType: input.mime,
      checksumSha256: input.checksumSha256,
    });
    return { storageKey: target.storageKey, driver: target.storage.driver };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';

    if (target.storage.driver !== 'google-drive') {
      await increment('upload_storage_failures');
      logger.error('upload_storage_failed', { workspaceId: input.workspaceId, message });
      throw ApiError.unavailable('The document could not be stored. Please try again.');
    }

    // Revoked access, a full Drive or a transient Google error must not lose
    // the user's upload: it lands in the deployment's storage instead.
    logger.warn('drive_upload_failed_falling_back', { workspaceId: input.workspaceId, message });
    await prisma.storageConnection
      .updateMany({ where: { userId: input.userId }, data: { lastError: message.slice(0, 300) } })
      .catch(() => undefined);

    const storage = getStorage();
    const storageKey = generateStorageKey(input.workspaceId, input.extension);
    try {
      await storage.putObject(storageKey, input.bytes, {
        contentType: input.mime,
        checksumSha256: input.checksumSha256,
      });
    } catch {
      await increment('upload_storage_failures');
      throw ApiError.unavailable('The document could not be stored. Please try again.');
    }
    return { storageKey, driver: storage.driver };
  }
}

/** How long a browser has to finish a direct-to-storage upload. */
const DIRECT_UPLOAD_SECONDS = 900;

export type UploadTarget =
  | { direct: false; maxUploadMb: number }
  | {
      direct: true;
      maxUploadMb: number;
      storageKey: string;
      uploadUrl: string;
      method: 'PUT';
      headers: Record<string, string>;
      expiresInSeconds: number;
    };

/**
 * Describes how the browser should send a file. Direct storage uploads keep
 * large documents off the request-body limit of the app host (a Vercel
 * Function rejects bodies above roughly 4.5 MB); local storage and a connected
 * Google Drive cannot accept a presigned PUT, so those stay multipart.
 */
export async function createDocumentUploadTarget(input: {
  workspaceId: string;
  userId: string;
  filename: string;
  sizeBytes: number;
  contentType?: string | null;
}): Promise<UploadTarget> {
  const maxUploadMb = await assertUploadSizeAllowed(input.workspaceId, input.sizeBytes);
  const maxBytes = Math.min(appConfig.maxUploadBytes, 100 * 1024 * 1024);
  if (input.sizeBytes > maxBytes) {
    throw ApiError.payloadTooLarge(`Files must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`);
  }
  if (appConfig.storageDriver === 'local') return { direct: false, maxUploadMb };

  const connection = await Promise.resolve()
    .then(() => prisma.storageConnection.findUnique({ where: { userId: input.userId }, select: { id: true } }))
    .catch(() => null);
  if (connection) return { direct: false, maxUploadMb };

  const contentType = input.contentType?.trim() || 'application/octet-stream';
  const storageKey = generateStorageKey(input.workspaceId, extensionForMime(contentType));
  const uploadUrl = await getStorage().createUploadUrl(storageKey, contentType, DIRECT_UPLOAD_SECONDS);

  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (appConfig.storageDriver === 'supabase') {
    // Matches the signed token's upsert decision and avoids provider defaults.
    headers['x-upsert'] = 'false';
    headers['cache-control'] = 'max-age=3600';
  } else if (appConfig.storageDriver === 's3' && appConfig.s3.serverSideEncryption) {
    // The header must match what the presigned URL was signed with.
    headers['x-amz-server-side-encryption'] = appConfig.s3.serverSideEncryption;
  }

  return {
    direct: true,
    maxUploadMb,
    storageKey,
    uploadUrl,
    method: 'PUT',
    headers,
    expiresInSeconds: DIRECT_UPLOAD_SECONDS,
  };
}

type PersistUploadInput = {
  workspaceId: string;
  userId: string;
  validated: ValidatedUpload;
  declaredMime: string | null;
  correlationId: string;
  ipHash: string;
  startedAt: number;
  /** Object key whose bytes the browser already put in deployment storage. */
  preStoredKey?: string;
};

async function persistDocument(input: PersistUploadInput) {
  const { validated } = input;

  // A byte-identical document in this workspace already owns those bytes.
  // Reuse its object instead of storing the same file twice.
  const duplicate = await findChecksumDuplicate(input.workspaceId, validated.checksumSha256);

  let storageKey: string;
  let storedDriver: StorageProvider['driver'] | null = null;
  if (input.preStoredKey) {
    storageKey = input.preStoredKey;
    if (duplicate?.storageKey) {
      storageKey = duplicate.storageKey;
      await increment('uploads_deduplicated');
      // The browser's bytes arrived before the duplicate was known and
      // nothing references that object, so remove it.
      await getStorage().deleteObject(input.preStoredKey).catch(() => undefined);
    }
  } else if (duplicate?.storageKey) {
    storageKey = duplicate.storageKey;
    await increment('uploads_deduplicated');
  } else {
    const stored = await storeUpload({
      userId: input.userId,
      workspaceId: input.workspaceId,
      extension: validated.extension,
      bytes: validated.bytes,
      mime: validated.mime,
      checksumSha256: validated.checksumSha256,
    });
    storageKey = stored.storageKey;
    storedDriver = stored.driver;
  }

  // Integrity verification: the stored bytes must match the accepted upload.
  if (storedDriver === 'local') {
    const readBack = await getStorage().getObject(storageKey);
    const digest = createHash('sha256').update(readBack).digest('hex');
    if (digest !== validated.checksumSha256) {
      await getStorage().deleteObject(storageKey).catch(() => undefined);
      throw ApiError.internal('Stored file failed its integrity check');
    }
  }

  let createdDocumentId: string | null = null;
  try {
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
          declaredMime: input.declaredMime,
          quarantined: false,
          deduplicated: Boolean(duplicate),
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
    await observe('upload_duration', Date.now() - input.startedAt);

    return { document, job, duplicate: duplicate ?? null };
  } catch (error) {
    // Never leave an orphaned object if the database write fails.
    if (!duplicate) {
      await (await getStorageForKey(storageKey)).deleteObject(storageKey).catch(() => undefined);
    }
    if (createdDocumentId) {
      await prisma.document.delete({ where: { id: createdDocumentId } }).catch(() => undefined);
    }
    throw error;
  }
}

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

  return persistDocument({
    workspaceId: input.workspaceId,
    userId: input.userId,
    validated,
    declaredMime: input.file.type || null,
    correlationId: input.correlationId,
    ipHash: input.ipHash,
    startedAt,
  });
}

/**
 * Records a document whose bytes the browser already put in storage through a
 * presigned URL. The object is re-read and validated exactly like a multipart
 * upload, so direct uploads are not trusted any more than the request path.
 */
export async function createDocumentFromStoredUpload(input: {
  workspaceId: string;
  userId: string;
  storageKey: string;
  filename: string;
  correlationId: string;
  ipHash: string;
}) {
  const startedAt = Date.now();
  const prefix = `workspaces/${input.workspaceId}/`;
  if (!input.storageKey.startsWith(prefix) || input.storageKey.length > 300) {
    throw ApiError.validation([{ path: 'storageKey', message: 'Upload target is not valid' }]);
  }

  const maxBytes = Math.min(appConfig.maxUploadBytes, 100 * 1024 * 1024);
  const storage = getStorage();

  let bytes: Uint8Array;
  try {
    bytes = await storage.getObject(input.storageKey);
  } catch {
    throw ApiError.badRequest('The uploaded file was not found. Please upload it again.');
  }

  let validated: ValidatedUpload;
  try {
    await assertUploadSizeAllowed(input.workspaceId, bytes.byteLength);
    validated = await validateUploadFile({ bytes, filename: input.filename, maxBytes });
    await assertCanProcess(input.workspaceId, validated.pageCount);
  } catch (error) {
    // Rejected bytes must not stay in the bucket.
    await storage.deleteObject(input.storageKey).catch(() => undefined);
    throw error;
  }

  return persistDocument({
    workspaceId: input.workspaceId,
    userId: input.userId,
    validated,
    declaredMime: null,
    correlationId: input.correlationId,
    ipHash: input.ipHash,
    startedAt,
    preStoredKey: input.storageKey,
  });
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
  let shared = false;
  try {
    const result = await deleteObjectIfUnreferenced(document.storageKey, { excludingDocumentId: documentId });
    storageDeleted = result.deleted;
    shared = result.shared;
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
        status: storageDeleted || shared ? 'completed' : 'failed',
        completedAt: storageDeleted || shared ? new Date() : null,
        lastError: storageDeleted || shared ? null : 'object_delete_failed',
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
  const storage = await getStorageForKey(document.storageKey);
  const url = await storage.createDownloadUrl(
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
  const storage = await getStorageForKey(storageKey);
  return storage.getObject(storageKey);
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
