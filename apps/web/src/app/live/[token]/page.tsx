import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildLiveExportData } from '@/lib/exports/live';
import { liveWorkbookXlsxPath, readLiveWorkbookToken } from '@/lib/exports/live-token';
import { assertFormatAllowed } from '@/lib/exports/service';
import { fieldLabel } from '@/lib/documents/fields';
import { ApiError } from '@/lib/http/errors';
import { LiveRefresh } from './LiveRefresh';
import styles from './live.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live export',
  robots: { index: false, follow: false },
};

const PAGE_ROWS = 500;

const BASE_LABELS: Record<string, string> = {
  document_id: 'Document ID',
  file_name: 'File name',
  status: 'Status',
  kind: 'Kind',
  page_count: 'Pages',
  duplicate_of: 'Duplicate of',
  uploaded_at: 'Uploaded',
  extraction_version: 'Extraction',
};

function label(column: string): string {
  return BASE_LABELS[column] ?? fieldLabel(column);
}

function timestamp(value: Date): string {
  return `${value.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

/**
 * The permanent live view. No session and no stored file: the table is read
 * from the database on every request, so the link always shows current data.
 */
export default async function LiveExportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const workspaceId = readLiveWorkbookToken(token);
  if (!workspaceId) notFound();

  let data: Awaited<ReturnType<typeof buildLiveExportData>>;
  try {
    // XLSX (and therefore this view) is a paid-plan entitlement.
    await assertFormatAllowed(workspaceId, 'xlsx');
    data = await buildLiveExportData(workspaceId, PAGE_ROWS);
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  if (!workspace) notFound();

  const { columns, rows, numericColumns, generatedAt } = data;
  const truncated = rows.length === PAGE_ROWS;

  return (
    <main className={styles.page} id="main">
      <LiveRefresh seconds={60} />
      <div className={styles.shell}>
        <header className={styles.top}>
          <div>
            <p className={styles.brand}>ParsePilot · live export</p>
            <h1 className={styles.title}>{workspace.name}</h1>
            <p className={styles.sub}>
              This page is read from the workspace every time it loads and every minute while it stays open, so it
              always shows the latest reviewed documents, processing results and field corrections. Saved as a
              bookmark, the link keeps working.
            </p>
          </div>
          <div className={styles.meta}>
            <span>Generated {timestamp(generatedAt)}</span>
            <span>
              {rows.length}
              {truncated ? '+' : ''} row{rows.length === 1 ? '' : 's'} · {columns.length} columns
            </span>
            <span>Refreshes every 60s</span>
          </div>
        </header>

        <div className={styles.toolbar}>
          <a className={styles.action} href={liveWorkbookXlsxPath(workspaceId)}>
            Download .xlsx
          </a>
          <a className={styles.action} href={`/live/${token}`}>
            Refresh now
          </a>
          <span className={styles.hint}>
            Anyone with this link can view this workspace&apos;s export. Treat it like a password.
          </span>
        </div>

        {truncated ? (
          <p className={styles.notice}>
            Showing the {PAGE_ROWS} most recent documents. The .xlsx download includes up to 20,000.
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className={styles.empty}>
            No completed or needs-review documents yet. This page fills in as soon as the pipeline finishes its first
            document.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {label(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.document_id ?? index)}>
                    {columns.map((column) => {
                      const value = row[column];
                      const text = value === null || value === undefined || value === '' ? '—' : String(value);
                      return (
                        <td
                          key={column}
                          className={numericColumns.has(column) ? styles.num : undefined}
                          title={text.length > 40 ? text : undefined}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className={styles.foot}>
          <span>Built live from ParsePilot — no snapshot is stored.</span>
          <span>
            {rows.length} row{rows.length === 1 ? '' : 's'} · {columns.length} columns · refreshed{' '}
            {timestamp(generatedAt)}
          </span>
        </footer>
      </div>
    </main>
  );
}
