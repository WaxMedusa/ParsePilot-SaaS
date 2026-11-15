import type { DocumentStatus, JobStatus, JobType, Prisma, ProcessingJob } from '@prisma/client';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { logger, categorizeError } from '../logger';
import { increment, observe } from '../observability/metrics';
import { recordAudit } from '../audit';
import { enqueueJobRemotely } from './queue';
import { validateExtraction, type IncomingField } from '../documents/fields';
import { recordPagesUsage } from '../billing/usage';
import { retentionConfig } from '../../config/retention';

/** Processing stage names — identical to the document status contract. */
export const PROCESSING_STAGES = [
  'extracting_text',
  'running_ocr',
  'extracting_fields',
  'validating',
  'detecting_duplicates',
] as const;
export type ProcessingStage = (typeof PROCESSING_STAGES)[number];

const TERMINAL: JobStatus[] = ['succeeded', 'failed', 'dead_letter', 'cancelled'];

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL.includes(status);
}

export function activeKeyFor(type: JobType, target: { documentId?: string | null; exportId?: string | null }): string {
  if (type === 'document_process' && target.documentId) return `document:${target.documentId}`;
  if (type === 'export_generate' && target.exportId) return `export:${target.exportId}`;
  return 'retention:sweep';
}

export function retryDelaySeconds(attempts: number): number {
  const base = Math.min(15 * 60, 30 * 2 ** Math.max(0, attempts - 1));
  // +/-10% jitter prevents synchronised retry storms.
  const jitter = base * 0.1 * (Math.random() * 2 - 1);
  return Math.min(15 * 60, Math.max(5, Math.round(base + jitter)));
}

/** Exponential backoff is also reflected on the document status timeline. */
export async function createJob(input: {
  workspaceId: string;
  type: JobType;
  documentId?: string;
  exportId?: string;
  idempotencyKey: string;
  correlationId: string;
  maxAttempts?: number;
  onActiveConflict?: 'return_existing' | 'throw';
}): Promise<ProcessingJob> {
  const activeKey = activeKeyFor(input.type, input);
  try {
    const job = await prisma.processingJob.create({
      data: {
        workspaceId: input.workspaceId,
        type: input.type,
        documentId: input.documentId ?? null,
        exportId: input.exportId ?? null,
        idempotencyKey: input.idempotencyKey,
        activeKey,
        correlationId: input.correlationId,
        maxAttempts: input.maxAttempts ?? 4,
      },
    });
    await enqueueJobRemotely(job);
    await increment('jobs_created', { type: input.type });
    logger.info('job_created', { jobId: job.id, type: input.type, workspaceId: input.workspaceId });
    return job;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      const existing = await prisma.processingJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
      const active = await prisma.processingJob.findUnique({ where: { activeKey } });
      if (active) {
        if (input.onActiveConflict === 'throw') {
          throw ApiError.conflict('A job for this target is already in progress', { jobId: active.id });
        }
        return active;
      }
    }
    throw error;
  }
}

export async function getJobForWorkspace(jobId: string, workspaceId: string) {
  const job = await prisma.processingJob.findFirst({
    where: { id: jobId, workspaceId },
    include: {
      document: { select: { id: true, originalName: true, status: true } },
      export: { select: { id: true, format: true, status: true } },
    },
  });
  if (!job) throw ApiError.notFound('Job not found');
  return job;
}

export async function listJobs(params: {
  workspaceId: string;
  skip: number;
  take: number;
  status?: string;
  documentId?: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}) {
  const where = {
    workspaceId: params.workspaceId,
    ...(params.status ? { status: params.status as JobStatus } : {}),
    ...(params.documentId ? { documentId: params.documentId } : {}),
  };
  const [total, jobs] = await prisma.$transaction([
    prisma.processingJob.count({ where }),
    prisma.processingJob.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { [params.sortField]: params.sortDirection },
      include: {
        document: { select: { id: true, originalName: true } },
        export: { select: { id: true, format: true } },
      },
    }),
  ]);
  return { total, jobs };
}

/** Atomically claims a queued job for a worker. Returns null if not claimable. */
export async function claimJob(jobId: string, workerId: string): Promise<ProcessingJob | null> {
  const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (isTerminal(job.status) || job.status === 'running') return null;
  if (job.availableAt.getTime() > Date.now()) return null;
  if (job.attempts >= job.maxAttempts) {
    await moveToDeadLetter(job, 'Maximum attempts exhausted before claim');
    return null;
  }

  const claimed = await prisma.processingJob.updateMany({
    where: { id: jobId, status: 'queued' },
    data: {
      status: 'running',
      lockedBy: workerId,
      lockedAt: new Date(),
      heartbeatAt: new Date(),
      startedAt: job.startedAt ?? new Date(),
      attempts: { increment: 1 },
      errorCode: null,
      errorMessage: null,
      errorCategory: null,
    },
  });
  if (claimed.count === 0) return null;

  await increment('jobs_claimed', { type: job.type });
  if (job.documentId && job.type === 'document_process') {
    await prisma.document.updateMany({
      where: { id: job.documentId, workspaceId: job.workspaceId, deletedAt: null },
      data: { status: 'extracting_text' },
    });
  }
  if (job.exportId && job.type === 'export_generate') {
    await prisma.export.updateMany({ where: { id: job.exportId }, data: { status: 'running' } });
  }
  return prisma.processingJob.findUnique({ where: { id: jobId } });
}

export async function recordStage(jobId: string, stage: string, workerId: string): Promise<void> {
  if (!PROCESSING_STAGES.includes(stage as ProcessingStage)) {
    throw ApiError.validation([{ path: 'stage', message: `Unsupported processing stage: ${stage}` }]);
  }
  const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.status !== 'running') throw ApiError.conflict('Job is not running');
  if (job.lockedBy && job.lockedBy !== workerId) throw ApiError.conflict('Job is locked by another worker');

  await prisma.$transaction([
    prisma.processingJob.update({
      where: { id: jobId },
      data: { stage, heartbeatAt: new Date() },
    }),
    ...(job.documentId
      ? [
          prisma.document.updateMany({
            where: { id: job.documentId, workspaceId: job.workspaceId, deletedAt: null },
            data: { status: stage as DocumentStatus },
          }),
        ]
      : []),
  ]);
  logger.info('job_stage', { jobId, stage });
}

export type ProcessingResultPayload = {
  pagesProcessed: number;
  ocrUsed: boolean;
  kind: string;
  language?: string | null;
  provider?: string | null;
  model?: string | null;
  durationMs?: number;
  fields: IncomingField[];
  duplicateCandidate?: { documentId: string; score: number } | null;
  warnings?: string[];
};

/**
 * Persists a completed extraction exactly once. Repeated callbacks are
 * idempotent: the job is terminal after the first success, and per-job usage
 * ledger keys prevent double billing.
 */
export async function completeDocumentProcessing(
  jobId: string,
  workerId: string,
  payload: ProcessingResultPayload,
): Promise<{ status: 'completed' | 'already_completed'; documentId: string }> {
  const startedAt = Date.now();
  const job = await prisma.processingJob.findUnique({ where: { id: jobId }, include: { document: true } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.type !== 'document_process' || !job.document) throw ApiError.conflict('Job is not a document processing job');
  if (job.status === 'succeeded') {
    return { status: 'already_completed', documentId: job.document.id };
  }
  if (job.status !== 'running' && job.status !== 'queued') throw ApiError.conflict('Job is not in a completable state');
  if (job.lockedBy && job.lockedBy !== workerId) throw ApiError.conflict('Job is locked by another worker');

  const document = job.document;
  const validation = validateExtraction(payload.fields ?? []);
  const pages = Math.max(1, Math.min(Number(payload.pagesProcessed) || 1, 5_000));

  // A duplicate candidate is only honoured if it belongs to the same workspace.
  let duplicateOfId: string | null = null;
  let duplicateScore: number | null = null;
  if (payload.duplicateCandidate?.documentId && payload.duplicateCandidate.documentId !== document.id) {
    const candidate = await prisma.document.findFirst({
      where: { id: payload.duplicateCandidate.documentId, workspaceId: job.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (candidate) {
      duplicateOfId = candidate.id;
      duplicateScore = Math.max(0, Math.min(1, Number(payload.duplicateCandidate.score) || 0));
    }
  }
  if (!duplicateOfId) {
    const checksumMatch = await prisma.document.findFirst({
      where: {
        workspaceId: job.workspaceId,
        checksumSha256: document.checksumSha256,
        deletedAt: null,
        id: { not: document.id },
        status: { in: ['completed', 'needs_review'] },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (checksumMatch) {
      duplicateOfId = checksumMatch.id;
      duplicateScore = 1;
    }
  }

  const needsReview = validation.requiresReview || Boolean(duplicateOfId);

  // The unique (documentId, version) constraint makes concurrent completions
  // safe: a losing transaction is retried and observes the winning version.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const previousRun = await tx.extractionRun.findFirst({
          where: { documentId: document.id },
          orderBy: { version: 'desc' },
          include: { fields: true },
        });
        const version = (previousRun?.version ?? 0) + 1;
        const previousEdits = new Map(
          (previousRun?.fields ?? [])
            .filter((field) => field.editedValue !== null && field.editedValue !== undefined)
            .map((field) => [field.fieldKey, field]),
        );

        const run = await tx.extractionRun.create({
          data: {
            documentId: document.id,
            version,
            status: 'completed',
            provider: payload.provider ?? null,
            model: payload.model ?? null,
            ocrUsed: Boolean(payload.ocrUsed),
            pagesProcessed: pages,
            durationMs: payload.durationMs ?? null,
            rawPayload: {
              fieldsExtracted: validation.fields.length,
              totalsConsistent: validation.totalsConsistent,
              issues: validation.issues.slice(0, 20),
              warnings: (payload.warnings ?? []).slice(0, 20),
            } as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });

        if (validation.fields.length > 0) {
          await tx.extractionField.createMany({
            data: validation.fields.map((field) => {
              const carried = previousEdits.get(field.key);
              return {
                extractionRunId: run.id,
                documentId: document.id,
                fieldKey: field.key,
                originalValue: field.value,
                normalizedValue: field.normalizedValue,
                confidence: field.confidence ?? null,
                valueType: field.type,
                // Manual corrections survive reprocessing.
                editedValue: carried?.editedValue ?? null,
                editedById: carried?.editedById ?? null,
                editedAt: carried?.editedAt ?? null,
              };
            }),
          });
        }

        await tx.document.update({
          where: { id: document.id },
          data: {
            status: needsReview ? 'needs_review' : 'completed',
            kind: (payload.kind as never) ?? 'unknown',
            language: payload.language ?? null,
            pageCount: pages,
            duplicateOfId,
            duplicateScore,
            failureCode: null,
            failureMessage: null,
            metadata: {
              validationIssues: validation.issues.slice(0, 20),
              totalsConsistent: validation.totalsConsistent,
              ocrUsed: Boolean(payload.ocrUsed),
              provider: payload.provider ?? null,
              model: payload.model ?? null,
            } as Prisma.InputJsonValue,
          },
        });

        await recordPagesUsage(tx, {
          workspaceId: job.workspaceId,
          documentId: document.id,
          jobId: job.id,
          pages,
        });

        await tx.processingJob.update({
          where: { id: job.id },
          data: {
            status: 'succeeded',
            stage: 'completed',
            finishedAt: new Date(),
            activeKey: null,
            heartbeatAt: null,
            errorCode: null,
            errorMessage: null,
            errorCategory: null,
            timings: {
              extractionMs: payload.durationMs ?? null,
              persistedMs: null,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            action: needsReview ? 'document.processed' : 'document.processed',
            workspaceId: job.workspaceId,
            targetType: 'document',
            targetId: document.id,
            requestId: job.correlationId,
            metadata: {
              version,
              pages,
              ocrUsed: Boolean(payload.ocrUsed),
              duplicate: Boolean(duplicateOfId),
              needsReview,
            } as Prisma.InputJsonValue,
          },
        });

        return { version, runId: run.id };
      });

      await increment('jobs_succeeded', { type: job.type });
      await observe('document_processing', startedAt ? Date.now() - startedAt : 0);
      logger.info('job_succeeded', { jobId, documentId: document.id, version: result.version });
      return { status: 'completed', documentId: document.id };
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (code !== 'P2002') throw error;
    }
  }
  throw lastError ?? ApiError.internal('Could not persist extraction result');
}

async function moveToDeadLetter(job: ProcessingJob, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'dead_letter',
        activeKey: null,
        finishedAt: new Date(),
        errorCode: job.errorCode ?? 'max_attempts_exhausted',
        errorMessage: job.errorMessage ?? reason,
        errorCategory: job.errorCategory ?? 'permanent',
      },
    }),
    prisma.deadLetterJob.upsert({
      where: { jobId: job.id },
      create: { jobId: job.id, reason, attempts: job.attempts, lastError: job.errorMessage },
      update: { reason, attempts: job.attempts, lastError: job.errorMessage },
    }),
  ]);
  if (job.documentId) {
    await prisma.document.updateMany({
      where: { id: job.documentId, workspaceId: job.workspaceId },
      data: { status: 'failed', failureCode: job.errorCode ?? 'max_attempts_exhausted', failureMessage: 'Processing failed after the maximum number of attempts' },
    });
  }
  await increment('jobs_dead_lettered', { type: job.type });
  await recordAudit({
    action: 'job.dead_lettered',
    workspaceId: job.workspaceId,
    targetType: 'job',
    targetId: job.id,
    metadata: { reason, attempts: job.attempts },
  });
}

export type JobFailure = { code: string; message: string; category?: string };

/** Records a worker failure and schedules a retry with exponential backoff. */
export async function failJob(jobId: string, workerId: string, failure: JobFailure): Promise<{ status: JobStatus; retryInSeconds: number | null }> {
  const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
  if (!job) throw ApiError.notFound('Job not found');
  if (isTerminal(job.status)) return { status: job.status, retryInSeconds: null };
  if (job.lockedBy && job.lockedBy !== workerId) throw ApiError.conflict('Job is locked by another worker');

  const category = failure.category ?? categorizeError(failure.message);
  const retryable = ['transient', 'provider', 'timeout', 'quota'].includes(category);
  const attempts = Math.max(job.attempts, 1);
  const canRetry = retryable && attempts < job.maxAttempts;
  const safeMessage = failure.message.slice(0, 500);
  const safeCode = failure.code.slice(0, 80);

  if (!canRetry) {
    await prisma.$transaction([
      prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          stage: 'failed',
          finishedAt: new Date(),
          activeKey: null,
          lockedBy: null,
          heartbeatAt: null,
          errorCode: safeCode,
          errorMessage: safeMessage,
          errorCategory: category,
        },
      }),
      ...(job.documentId
        ? [
            prisma.document.updateMany({
              where: { id: job.documentId, workspaceId: job.workspaceId },
              data: { status: 'failed', failureCode: safeCode, failureMessage: safeMessage },
            }),
          ]
        : []),
      ...(job.exportId
        ? [
            prisma.export.updateMany({
              where: { id: job.exportId, workspaceId: job.workspaceId },
              data: { status: 'failed', errorCode: safeCode, errorMessage: safeMessage },
            }),
          ]
        : []),
    ]);
    await increment('jobs_failed', { type: job.type, category });
    await recordAudit({
      action: 'document.process_failed',
      workspaceId: job.workspaceId,
      targetType: 'job',
      targetId: job.id,
      metadata: { code: safeCode, category, attempts },
    });
    if (attempts >= job.maxAttempts) {
      await moveToDeadLetter(job, `Retries exhausted (${category})`);
    }
    logger.error('job_failed', { jobId, type: job.type, code: safeCode, category, attempts });
    return { status: 'failed', retryInSeconds: null };
  }

  const delay = retryDelaySeconds(attempts);
  const updated = await prisma.processingJob.update({
    where: { id: job.id },
    data: {
      status: 'queued',
      stage: null,
      availableAt: new Date(Date.now() + delay * 1000),
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      errorCode: safeCode,
      errorMessage: safeMessage,
      errorCategory: category,
    },
  });
  if (job.documentId) {
    await prisma.document.updateMany({
      where: { id: job.documentId, workspaceId: job.workspaceId },
      data: { status: 'queued' },
    });
  }
  if (job.exportId) {
    await prisma.export.updateMany({ where: { id: job.exportId }, data: { status: 'queued' } });
  }
  await increment('jobs_retried', { type: job.type, category });
  logger.warn('job_retry_scheduled', { jobId, type: job.type, attempts, delaySeconds: delay, category });

  // The retry is announced immediately; the worker's queue delay is enforced by
  // `availableAt` at claim time, so a restart cannot lose the schedule.
  setTimeout(() => {
    enqueueJobRemotely(updated).catch(() => undefined);
  }, Math.min(delay * 1000, 5_000));

  return { status: 'queued', retryInSeconds: delay };
}

/** Manual retry from the dashboard. Clears the failure and re-queues the job. */
export async function retryJob(workspaceId: string, jobId: string, actorId: string): Promise<ProcessingJob> {
  const job = await prisma.processingJob.findFirst({ where: { id: jobId, workspaceId } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.status !== 'failed' && job.status !== 'dead_letter') {
    throw ApiError.conflict('Only failed jobs can be retried');
  }
  if (job.documentId) {
    const document = await prisma.document.findFirst({
      where: { id: job.documentId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!document) throw ApiError.conflict('The document for this job is no longer available');
  }

  const active = await prisma.processingJob.findUnique({ where: { activeKey: job.activeKey ?? activeKeyFor(job.type, job) } });
  if (active && active.id !== job.id) throw ApiError.conflict('Another job for this target is already in progress');

  const retried = await prisma.processingJob.update({
    where: { id: job.id },
    data: {
      status: 'queued',
      stage: null,
      attempts: 0,
      availableAt: new Date(),
      activeKey: activeKeyFor(job.type, job),
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      errorCategory: null,
    },
  });
  await prisma.deadLetterJob.updateMany({ where: { jobId: job.id }, data: { replayedAt: new Date() } });
  if (job.documentId) {
    await prisma.document.updateMany({
      where: { id: job.documentId, workspaceId },
      data: { status: 'queued', failureCode: null, failureMessage: null },
    });
  }
  if (job.exportId) {
    await prisma.export.updateMany({ where: { id: job.exportId }, data: { status: 'queued', errorCode: null, errorMessage: null } });
  }
  await enqueueJobRemotely(retried);
  await recordAudit({
    action: 'job.retried',
    workspaceId,
    actorId,
    targetType: 'job',
    targetId: job.id,
  });
  return retried;
}

/**
 * Reconciliation recovers from worker crashes and lost queue messages:
 *  - running jobs without a heartbeat beyond the threshold are failed + retried
 *  - queued jobs that were never announced are re-announced
 * Safe to run repeatedly.
 */
export async function reconcileJobs(): Promise<{ recovered: number; reannounced: number }> {
  const staleBefore = new Date(Date.now() - retentionConfig.stalledJobMinutes * 60 * 1000);

  const staleRunning = await prisma.processingJob.findMany({
    where: {
      status: 'running',
      OR: [{ heartbeatAt: { lt: staleBefore } }, { heartbeatAt: null, lockedAt: { lt: staleBefore } }],
    },
    take: 25,
  });

  let recovered = 0;
  for (const job of staleRunning) {
    try {
      await failJob(job.id, job.lockedBy ?? 'reconciler', {
        code: 'worker_heartbeat_lost',
        message: 'Worker stopped reporting progress; the job was re-queued',
        category: 'transient',
      });
      recovered += 1;
    } catch (error) {
      logger.error('reconcile_recovery_failed', { jobId: job.id, message: error instanceof Error ? error.message : 'unknown' });
    }
  }

  const pending = await prisma.processingJob.findMany({
    where: {
      status: 'queued',
      availableAt: { lte: new Date() },
      updatedAt: { lt: new Date(Date.now() - 60_000) },
    },
    take: 25,
    orderBy: { createdAt: 'asc' },
  });

  let reannounced = 0;
  for (const job of pending) {
    const result = await enqueueJobRemotely(job);
    if (result.enqueued) reannounced += 1;
  }

  if (recovered || reannounced) {
    await increment('jobs_reconciled', { kind: 'recovered' }, recovered);
    await increment('jobs_reconciled', { kind: 'reannounced' }, reannounced);
    logger.info('jobs_reconciled', { recovered, reannounced });
  }
  return { recovered, reannounced };
}

export function jobSummary(job: ProcessingJob & { document?: { id: string; originalName: string } | null; export?: { id: string; format: string } | null }) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    stage: job.stage,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    errorCategory: job.errorCategory,
    correlationId: job.correlationId,
    createdAt: job.createdAt.toISOString(),
    document: job.document ? { id: job.document.id, name: job.document.originalName } : null,
    export: job.export ? { id: job.export.id, format: job.export.format } : null,
  };
}
