import { prisma } from '../prisma';
import { ApiError } from '../http/errors';

/**
 * Data access layer for documents. Every query is scoped by workspaceId; a
 * document id alone is never sufficient to read or mutate a record.
 */

export type DocumentSummary = {
  id: string;
  originalName: string;
  status: string;
  kind: string;
  pageCount: number | null;
  sizeBytes: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  failureCode: string | null;
  duplicateOfId: string | null;
  totalAmount: string | null;
  currency: string | null;
  vendorName: string | null;
  documentNumber: string | null;
  issueDate: string | null;
};

export async function findDocumentForWorkspace(documentId: string, workspaceId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId, deletedAt: null },
    include: {
      extractionRuns: {
        orderBy: { version: 'desc' },
        take: 2,
        include: { fields: true },
      },
      jobs: { orderBy: { createdAt: 'desc' }, take: 3 },
      uploadedBy: { select: { id: true, email: true, name: true } },
    },
  });
  if (!document) throw ApiError.notFound('Document not found');
  return document;
}

export async function listDocuments(params: {
  workspaceId: string;
  skip: number;
  take: number;
  status?: string;
  kind?: string;
  search?: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  includeDeleted?: boolean;
}) {
  const where = {
    workspaceId: params.workspaceId,
    deletedAt: params.includeDeleted ? undefined : null,
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.kind ? { kind: params.kind as never } : {}),
    ...(params.search
      ? {
          OR: [
            { originalName: { contains: params.search, mode: 'insensitive' as const } },
            { extractionRuns: { some: { fields: { some: { fieldKey: 'vendor_name', OR: [{ editedValue: { contains: params.search, mode: 'insensitive' as const } }, { normalizedValue: { contains: params.search, mode: 'insensitive' as const } }] } } } } },
            { extractionRuns: { some: { fields: { some: { fieldKey: 'document_number', OR: [{ editedValue: { contains: params.search, mode: 'insensitive' as const } }, { normalizedValue: { contains: params.search, mode: 'insensitive' as const } }] } } } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { [params.sortField]: params.sortDirection },
      include: {
        extractionRuns: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            fields: { select: { fieldKey: true, originalValue: true, normalizedValue: true, editedValue: true } },
          },
        },
      },
    }),
  ]);

  const summaries: DocumentSummary[] = rows.map((row) => {
    const fields = row.extractionRuns[0]?.fields ?? [];
    const valueOf = (key: string) => {
      const field = fields.find((entry) => entry.fieldKey === key);
      if (!field) return null;
      return field.editedValue || field.normalizedValue || field.originalValue;
    };
    return {
      id: row.id,
      originalName: row.originalName,
      status: row.status,
      kind: row.kind,
      pageCount: row.pageCount,
      sizeBytes: row.sizeBytes,
      mimeType: row.mimeType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      failureCode: row.failureCode,
      duplicateOfId: row.duplicateOfId,
      totalAmount: valueOf('total_amount'),
      currency: valueOf('currency'),
      vendorName: valueOf('vendor_name'),
      documentNumber: valueOf('document_number'),
      issueDate: valueOf('issue_date'),
    };
  });

  return { total, documents: summaries };
}

export async function countDocumentsByStatus(workspaceId: string) {
  const grouped = await prisma.document.groupBy({
    by: ['status'],
    where: { workspaceId, deletedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((entry) => [entry.status, entry._count._all]));
}

/** Exact checksum duplicates within the same workspace only. */
export async function findChecksumDuplicate(workspaceId: string, checksumSha256: string, excludeDocumentId?: string) {
  return prisma.document.findFirst({
    where: {
      workspaceId,
      checksumSha256,
      deletedAt: null,
      ...(excludeDocumentId ? { id: { not: excludeDocumentId } } : {}),
    },
    select: { id: true, originalName: true, createdAt: true },
  });
}

export async function getLatestExtraction(documentId: string, workspaceId: string) {
  const run = await prisma.extractionRun.findFirst({
    where: { documentId, document: { workspaceId, deletedAt: null } },
    orderBy: { version: 'desc' },
    include: { fields: { orderBy: { fieldKey: 'asc' } } },
  });
  if (!run) return null;
  return run;
}

/** Tenant-aware field update; only the latest extraction version is editable. */
export async function updateFieldValue(params: {
  workspaceId: string;
  documentId: string;
  fieldId: string;
  editedValue: string | null;
  editorId: string;
}) {
  const field = await prisma.extractionField.findFirst({
    where: {
      id: params.fieldId,
      documentId: params.documentId,
      document: { workspaceId: params.workspaceId, deletedAt: null },
    },
    select: { id: true, extractionRunId: true, documentId: true, fieldKey: true },
  });
  if (!field) throw ApiError.notFound('Field not found');

  const latest = await prisma.extractionRun.findFirst({
    where: { documentId: params.documentId },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (!latest || latest.id !== field.extractionRunId) {
    throw ApiError.conflict('Only fields from the latest extraction can be edited');
  }

  return prisma.extractionField.update({
    where: { id: field.id },
    data: {
      editedValue: params.editedValue,
      editedAt: new Date(),
      editedById: params.editorId,
    },
  });
}

export async function listWorkspaceExtractionRows(workspaceId: string, limit = 20_000) {
  return prisma.document.findMany({
    where: { workspaceId, deletedAt: null, status: { in: ['completed', 'needs_review'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      extractionRuns: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { version: true, fields: { select: { fieldKey: true, originalValue: true, normalizedValue: true, editedValue: true, confidence: true } } },
      },
    },
  });
}
