import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { recordAudit } from '../audit';
import { createJob } from '../jobs/service';
import { listWorkspaceExtractionRows } from '../documents/repository';
import { FIELD_DEFINITIONS, resolveFieldValue } from '../documents/fields';
import { planSupportsFormat } from '../billing/plans';
import { getStorage } from '../storage';
import { retentionConfig } from '../../config/retention';
import { logger } from '../logger';
import { recordExportRows } from '../billing/usage';

/**
 * Exports are generated asynchronously by the processing worker and stored in
 * private object storage. The API never builds files inside the request cycle.
 */

export const EXPORT_BASE_COLUMNS = [
  'document_id',
  'file_name',
  'status',
  'kind',
  'page_count',
  'duplicate_of',
  'uploaded_at',
  'extraction_version',
] as const;

export type ExportRow = Record<string, string | number | null>;

export async function createExport(input: {
  workspaceId: string;
  userId: string;
  format: 'csv' | 'xlsx';
  filters?: Record<string, unknown>;
  correlationId: string;
}) {
  const workspace = await prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { planCode: true } });
  if (!workspace) throw ApiError.notFound('Workspace not found');
  const plan = await prisma.plan.findUnique({ where: { code: workspace.planCode } });
  if (!plan) throw ApiError.internal('Plan configuration missing');
  if (!planSupportsFormat(plan, input.format)) {
    throw ApiError.forbidden(`${input.format.toUpperCase()} exports are not included in your plan`);
  }

  const exportRecord = await prisma.export.create({
    data: {
      workspaceId: input.workspaceId,
      requestedById: input.userId,
      format: input.format,
      filters: (input.filters ?? {}) as Prisma.InputJsonValue,
    },
  });

  const job = await createJob({
    workspaceId: input.workspaceId,
    type: 'export_generate',
    exportId: exportRecord.id,
    idempotencyKey: `export:${exportRecord.id}`,
    correlationId: input.correlationId,
  });

  await recordAudit({
    action: 'export.created',
    workspaceId: input.workspaceId,
    actorId: input.userId,
    targetType: 'export',
    targetId: exportRecord.id,
    metadata: { format: input.format, jobId: job.id },
  });
  return { export: exportRecord, job };
}

export async function listExports(workspaceId: string, take = 50) {
  return prisma.export.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      format: true,
      status: true,
      rowCount: true,
      sizeBytes: true,
      expiresAt: true,
      createdAt: true,
      completedAt: true,
      errorMessage: true,
      requestedBy: { select: { email: true } },
    },
  });
}

export async function getExport(workspaceId: string, exportId: string) {
  const record = await prisma.export.findFirst({ where: { id: exportId, workspaceId } });
  if (!record) throw ApiError.notFound('Export not found');
  return record;
}

/** Builds the export payload for the worker. Includes both original and edited values. */
export async function buildExportDataset(workspaceId: string, exportId: string) {
  const record = await getExport(workspaceId, exportId);
  if (record.status === 'expired') throw ApiError.conflict('This export has expired');

  const documents = await listWorkspaceExtractionRows(workspaceId);
  const fieldKeys = new Set<string>(FIELD_DEFINITIONS.map((definition) => definition.key));
  for (const document of documents) {
    for (const field of document.extractionRuns[0]?.fields ?? []) fieldKeys.add(field.fieldKey);
  }

  const rows: ExportRow[] = documents.map((document) => {
    const fields = document.extractionRuns[0]?.fields ?? [];
    const row: ExportRow = {
      document_id: document.id,
      file_name: document.originalName,
      status: document.status,
      kind: document.kind,
      page_count: document.pageCount ?? null,
      duplicate_of: document.duplicateOfId ?? null,
      uploaded_at: document.createdAt.toISOString(),
      extraction_version: document.extractionRuns[0]?.version ?? null,
    };
    for (const key of fieldKeys) {
      const field = fields.find((entry) => entry.fieldKey === key);
      if (!field) {
        row[key] = null;
        continue;
      }
      const resolved = resolveFieldValue(field);
      row[key] = key === 'line_items' && resolved ? resolved.slice(0, 8_000) : resolved;
    }
    return row;
  });

  const columns = [...EXPORT_BASE_COLUMNS, ...Array.from(fieldKeys)];
  return {
    exportId: record.id,
    workspaceId,
    format: record.format,
    columns,
    rows,
    generatedFor: record.requestedById,
  };
}

export async function completeExport(
  exportId: string,
  data: { storageKey: string; sizeBytes: number; rowCount: number },
) {
  const record = await prisma.export.findUnique({ where: { id: exportId } });
  if (!record) throw ApiError.notFound('Export not found');
  if (record.status === 'completed') return record;

  const expiresAt = new Date(Date.now() + retentionConfig.exportDays * 24 * 60 * 60 * 1000);
  const updated = await prisma.export.update({
    where: { id: exportId },
    data: {
      status: 'completed',
      storageKey: data.storageKey,
      sizeBytes: data.sizeBytes,
      rowCount: data.rowCount,
      expiresAt,
      completedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  });
  await recordExportRows(record.workspaceId, data.rowCount);
  await recordAudit({
    action: 'export.created',
    workspaceId: record.workspaceId,
    targetType: 'export',
    targetId: record.id,
    metadata: { completed: true, rowCount: data.rowCount, format: record.format },
  });
  logger.info('export_completed', { exportId, rowCount: data.rowCount, format: record.format });
  return updated;
}

export async function buildDownloadUrl(workspaceId: string, exportId: string, actorId: string) {
  const record = await getExport(workspaceId, exportId);
  if (record.status !== 'completed' || !record.storageKey) {
    throw ApiError.conflict('This export is not ready for download');
  }
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    throw ApiError.conflict('This export has expired');
  }
  const storage = getStorage();
  const contentType = record.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const url = await storage.createDownloadUrl(
    record.storageKey,
    retentionConfig.signedUrlSeconds,
    `parsepilot-export-${record.createdAt.toISOString().slice(0, 10)}.${record.format}`,
    contentType,
  );
  await recordAudit({
    action: 'export.downloaded',
    workspaceId,
    actorId,
    targetType: 'export',
    targetId: record.id,
  });
  return { url, expiresInSeconds: retentionConfig.signedUrlSeconds, format: record.format };
}

/** Marks stale exports expired; object removal happens in the retention sweep. */
export async function expireStaleExports(): Promise<number> {
  const stale = await prisma.export.findMany({
    where: { status: 'completed', expiresAt: { lt: new Date() } },
    select: { id: true, workspaceId: true },
    take: 200,
  });
  if (stale.length === 0) return 0;
  await prisma.export.updateMany({
    where: { id: { in: stale.map((entry) => entry.id) } },
    data: { status: 'expired' },
  });
  for (const entry of stale) {
    await recordAudit({
      action: 'export.expired',
      workspaceId: entry.workspaceId,
      targetType: 'export',
      targetId: entry.id,
    });
  }
  return stale.length;
}
