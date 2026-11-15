'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './DocumentActions.module.css';

type Props = {
  documentId: string;
  workspaceId: string;
  status: string;
  canRetry: boolean;
};

export function DocumentActions({ documentId, workspaceId, status, canRetry }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (key: string, action: () => Promise<unknown>, options?: { reload?: boolean }) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      if (options?.reload !== false) router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const download = () =>
    run('download', async () => {
      const result = await apiRequest<{ url: string }>(`/api/v1/documents/${documentId}/download-url`, {
        method: 'POST',
        workspaceId,
      });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }, { reload: false });

  const reprocess = () =>
    run('process', () => apiRequest(`/api/v1/documents/${documentId}/process`, { method: 'POST', workspaceId }));

  const retry = () =>
    run('retry', () => apiRequest(`/api/v1/documents/${documentId}/retry`, { method: 'POST', workspaceId }));

  const remove = () =>
    run('delete', async () => {
      await apiRequest(`/api/v1/documents/${documentId}`, { method: 'DELETE', workspaceId });
      router.push('/dashboard/documents');
    }, { reload: false });

  const processing = ['queued', 'uploaded', 'extracting_text', 'running_ocr', 'extracting_fields', 'validating', 'detecting_duplicates'].includes(status);

  return (
    <div className={styles.wrap}>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" icon={<Download />} onClick={download} disabled={busy !== null}>
          {busy === 'download' ? 'Preparing…' : 'Download'}
        </Button>
        {canRetry ? (
          <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={retry} disabled={busy !== null}>
            {busy === 'retry' ? 'Re-queuing…' : 'Retry failed job'}
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={reprocess} disabled={busy !== null || processing}>
          {busy === 'process' ? 'Queuing…' : 'Reprocess'}
        </Button>
        {confirmDelete ? (
          <span className={styles.confirm}>
            <span>Delete this document?</span>
            <Button variant="danger" size="sm" onClick={remove} disabled={busy !== null}>
              {busy === 'delete' ? 'Deleting…' : 'Confirm delete'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={() => setConfirmDelete(true)} className={styles.deleteButton}>
            Delete
          </Button>
        )}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
