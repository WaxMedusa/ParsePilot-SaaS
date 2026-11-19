'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiRequest, errorMessage } from '@/lib/client/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import styles from './Dashboard.module.css';

export type ExportRow = {
  id: string;
  format: 'csv' | 'xlsx';
  status: string;
  rowCount: number | null;
  sizeBytes: number | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

export function ExportsPanel({
  initialExports,
  workspaceId,
  canCreate,
  xlsxAllowed,
  liveUrl,
}: {
  initialExports: ExportRow[];
  workspaceId: string;
  canCreate: boolean;
  xlsxAllowed: boolean;
  liveUrl: string;
}) {
  const [exports, setExports] = useState<ExportRow[]>(initialExports);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | undefined>(undefined);

  // The dashboard refreshes server data in place; keep the client export list
  // in sync with that snapshot instead of only refreshing while a job is open.
  useEffect(() => {
    setExports(initialExports);
  }, [initialExports]);

  const refresh = useCallback(async () => {
    try {
      const rows = await apiRequest<ExportRow[]>('/api/v1/exports', { workspaceId });
      setExports(rows);
      return rows;
    } catch {
      return exports;
    }
  }, [exports, workspaceId]);

  useEffect(() => {
    const pending = exports.some((entry) => entry.status === 'queued' || entry.status === 'running');
    if (!pending) {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
      return;
    }
    pollTimer.current = window.setTimeout(() => {
      void refresh();
    }, 4000);
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [exports, refresh]);

  const create = async (format: 'csv' | 'xlsx') => {
    setBusy(format);
    setError(null);
    try {
      await apiRequest('/api/v1/exports', { method: 'POST', workspaceId, body: { format } });
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const download = async (entry: ExportRow) => {
    setBusy(entry.id);
    setError(null);
    try {
      const result = await apiRequest<{ url: string }>(`/api/v1/exports/${entry.id}/download`, { workspaceId });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const downloadLive = async () => {
    setBusy('live');
    setError(null);
    try {
      const response = await fetch('/api/v1/exports/live', {
        headers: {
          accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'x-workspace-id': workspaceId,
        },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        let message = 'The workbook could not be built.';
        try {
          const payload = (await response.json()) as { error?: { message?: string } };
          message = payload.error?.message ?? message;
        } catch {
          // The endpoint may have returned a non-JSON failure; use the safe fallback above.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = /filename="([^"]+)"/i.exec(disposition)?.[1] ?? 'parsepilot-live.xlsx';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const copyLiveLink = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError('The link could not be copied. Select the field and copy it manually.');
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Live workbook</span>
          <span className={styles.cardHint}>permanent link · rebuilt on every open</span>
        </div>
        <div className={styles.cardBody}>
          <p className={styles.sectionBody}>
            This link returns the workbook built from the workspace as it is right now, every time it is requested.
            Connect it once in Excel with <strong>Data → Get Data → From Other Sources → From Web</strong>, then use
            <strong> Refresh All</strong> whenever you want the latest uploads, processing results and field
            corrections. A file you download is a snapshot of the moment you clicked; the link never goes stale.
            Google Sheets only imports files, so it needs the downloaded snapshot rather than this link.
          </p>
          <div className={styles.formRow} style={{ marginTop: 14 }}>
            <label className={styles.label} htmlFor="live-workbook-url">
              Live link
            </label>
            <input
              id="live-workbook-url"
              className={styles.input}
              readOnly
              value={xlsxAllowed ? liveUrl : 'XLSX exports are included on Starter and above.'}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet />}
              onClick={copyLiveLink}
              disabled={!xlsxAllowed || busy !== null}
              title={xlsxAllowed ? undefined : 'XLSX exports are included on Starter and above.'}
            >
              {copied ? 'Copied' : 'Copy live link'}
            </Button>
            <Button
              variant="secondary"
              icon={<Download />}
              onClick={downloadLive}
              disabled={busy !== null || !xlsxAllowed}
              title={xlsxAllowed ? undefined : 'XLSX exports are included on Starter and above.'}
            >
              {busy === 'live' ? 'Building workbook…' : 'Download snapshot'}
            </Button>
          </div>
          <p className={styles.hint} style={{ marginTop: 10 }}>
            {xlsxAllowed
              ? 'The link is a private key for this workspace: anyone who has it can download this data. Rotating DOWNLOAD_SIGNING_SECRET revokes every link.'
              : 'XLSX is included on Starter and above · CSV is available on every plan'}
          </p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Create a snapshot export</span>
          <span className={styles.cardHint}>Background job · private file</span>
        </div>
        <div className={styles.cardBody}>
          <p className={styles.sectionBody}>
            Exports include every reviewed document in this workspace with both original and edited field values. The
            file is generated by the processing worker, stored privately, and expires automatically.
          </p>
          {canCreate ? (
            <div className={styles.actions} style={{ marginTop: 14 }}>
              <Button variant="secondary" icon={<FileText />} onClick={() => create('csv')} disabled={busy !== null}>
                {busy === 'csv' ? 'Queuing…' : 'New CSV export'}
              </Button>
              <Button
                variant="secondary"
                icon={<FileSpreadsheet />}
                onClick={() => create('xlsx')}
                disabled={busy !== null || !xlsxAllowed}
                title={xlsxAllowed ? undefined : 'XLSX exports are included on Starter and above.'}
              >
                {busy === 'xlsx' ? 'Queuing…' : 'New XLSX snapshot'}
              </Button>
              {!xlsxAllowed ? (
                <span className={styles.hint}>XLSX exports are included on Starter and above. CSV is available on every plan.</span>
              ) : null}
            </div>
          ) : (
            <p className={styles.notice + ' ' + styles.noticeInfo} style={{ marginTop: 12 }}>
              Your role is read-only, so you can download existing exports but not create new ones.
            </p>
          )}
          {error ? <p className={styles.errorText} style={{ marginTop: 10 }}>{error}</p> : null}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Export history</span>
          <span className={styles.cardHint}>{exports.length} item{exports.length === 1 ? '' : 's'}</span>
        </div>
        {exports.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Download size={16} />
            </span>
            <p className={styles.emptyTitle}>No exports yet</p>
            <p className={styles.emptyBody}>
              {xlsxAllowed
                ? 'Use the live workbook link above for current data, or create a CSV snapshot with the full field set, including corrections.'
                : 'Create a CSV snapshot with the full field set, including corrections. XLSX exports are included on Starter and above.'}
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {exports.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className={styles.tag}>{entry.format.toUpperCase()}</span>
                    </td>
                    <td>
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className={styles.amount}>{entry.rowCount ?? '—'}</td>
                    <td className={styles.amount}>{entry.sizeBytes ? formatBytes(entry.sizeBytes) : '—'}</td>
                    <td className={styles.amount}>{formatDateTime(entry.createdAt)}</td>
                    <td className={styles.amount}>{entry.expiresAt ? formatDateTime(entry.expiresAt) : '—'}</td>
                    <td>
                      {entry.status === 'completed' ? (
                        <Button variant="secondary" size="sm" icon={<Download />} onClick={() => download(entry)} disabled={busy !== null}>
                          {busy === entry.id ? 'Preparing…' : 'Download'}
                        </Button>
                      ) : entry.status === 'queued' || entry.status === 'running' ? (
                        <span className={styles.cellSub} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Loader2 size={11} /> working
                        </span>
                      ) : entry.errorMessage ? (
                        <span className={styles.cellSub}>{entry.errorMessage.slice(0, 60)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
