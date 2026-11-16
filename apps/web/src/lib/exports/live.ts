import { listWorkspaceExtractionRows } from '../documents/repository';
import { FIELD_DEFINITIONS, resolveFieldValue } from '../documents/fields';
import { EXPORT_BASE_COLUMNS, type ExportRow } from './service';
import { buildXlsx } from './xlsx';

const NUMERIC_BASE_COLUMNS = new Set(['page_count', 'extraction_version']);
const NUMERIC_FIELD_TYPES = new Set(['decimal', 'integer']);

/**
 * Builds a workbook from the workspace's current completed and needs-review
 * documents. This is deliberately not a stored snapshot: downloading the live
 * file always reflects the latest reviewed data, corrections and new uploads.
 */
export async function buildLiveExport(workspaceId: string, limit = 20_000) {
  const documents = await listWorkspaceExtractionRows(workspaceId, limit);
  const fieldKeys = new Set<string>(FIELD_DEFINITIONS.map((definition) => definition.key));
  for (const document of documents) {
    for (const field of document.extractionRuns[0]?.fields ?? []) fieldKeys.add(field.fieldKey);
  }
  for (const baseColumn of EXPORT_BASE_COLUMNS) fieldKeys.delete(baseColumn);

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
  const numericColumns = new Set<string>(NUMERIC_BASE_COLUMNS);
  for (const definition of FIELD_DEFINITIONS) {
    if (NUMERIC_FIELD_TYPES.has(definition.type)) numericColumns.add(definition.key);
  }

  const generatedAt = new Date();
  const buffer = buildXlsx({
    columns,
    rows,
    numericColumns,
    sheetName: 'Documents',
    title: 'ParsePilot live export',
    generatedAt,
  });

  return { buffer, rowCount: rows.length, columnCount: columns.length, generatedAt };
}
