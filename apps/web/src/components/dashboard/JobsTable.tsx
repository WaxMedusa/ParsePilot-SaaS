'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiRequest, errorMessage } from '@/lib/client/api';
import { formatDateTime } from '@/lib/format';
import styles from './Dashboard.module.css';

export type JobRow = {
  id: string;
  type: string;
  status: string;
  stage: string | null;
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  document: { id: string; name: string } | null;
  export: { id: string; format: string } | null;
};

export function JobsTable({ jobs, workspaceId, showDocument = true }: { jobs: JobRow[]; workspaceId: string; showDocument?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = async (job: JobRow) => {
    if (!job.document) return;
    setBusy(job.id);
    setError(null);
    try {
      await apiRequest(`/api/v1/documents/${job.document.id}/retry`, { method: 'POST', workspaceId });
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No jobs yet</p>
        <p className={styles.emptyBody}>Upload a document and a processing job will appear here with its live stage and attempt count.</p>
      </div>
    );
  }

  return (
    <>
      {error ? <p className={styles.errorText} style={{ marginBottom: 10 }}>{error}</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Job</th>
              {showDocument ? <th>Target</th> : null}
              <th>Status</th>
              <th>Attempts</th>
              <th>Created</th>
              <th>Error</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <div className={styles.cellMain}>
                    <span className={styles.cellTitle}>{job.type.replace(/_/g, ' ')}</span>
                    <span className={styles.cellSub}>{job.id.slice(0, 8)}…</span>
                  </div>
                </td>
                {showDocument ? (
                  <td>
                    {job.document ? (
                      <Link href={`/dashboard/documents/${job.document.id}`} className={styles.cellTitle}>
                        {job.document.name}
                      </Link>
                    ) : job.export ? (
                      <span className={styles.tag}>{job.export.format.toUpperCase()} export</span>
                    ) : (
                      <span className={styles.cellSub}>maintenance</span>
                    )}
                  </td>
                ) : null}
                <td>
                  <StatusBadge status={job.status === 'running' && job.stage ? job.stage : job.status} />
                </td>
                <td className={styles.amount}>
                  {job.attempts}/{job.maxAttempts}
                </td>
                <td className={styles.amount}>{formatDateTime(job.createdAt)}</td>
                <td>
                  {job.errorCode ? (
                    <div className={styles.cellMain}>
                      <span className={styles.cellSub}>{job.errorCode}</span>
                      {job.errorMessage ? <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{job.errorMessage.slice(0, 90)}</span> : null}
                    </div>
                  ) : (
                    <span className={styles.cellSub}>—</span>
                  )}
                </td>
                <td>
                  {job.document && (job.status === 'failed' || job.status === 'dead_letter') ? (
                    <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={() => retry(job)} disabled={busy !== null}>
                      {busy === job.id ? 'Retrying…' : 'Retry'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
