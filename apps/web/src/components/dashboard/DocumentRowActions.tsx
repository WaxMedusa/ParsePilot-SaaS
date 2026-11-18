'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './DocumentsTable.module.css';

/**
 * Per-row delete. Destructive work stays behind one explicit confirmation and
 * never leaves the list, so a mis-click costs nothing.
 */
export function DocumentRowActions({
  documentId,
  workspaceId,
  documentName,
}: {
  documentId: string;
  workspaceId: string;
  documentName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/documents/${documentId}`, { method: 'DELETE', workspaceId });
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <span className={styles.confirm} role="group" aria-label={`Delete ${documentName}`}>
        <button type="button" className={styles.confirmYes} onClick={remove} disabled={busy}>
          {busy ? 'Deleting' : 'Delete'}
        </button>
        <button type="button" className={styles.confirmNo} onClick={() => setConfirming(false)} disabled={busy}>
          Keep
        </button>
      </span>
    );
  }

  return (
    <span className={styles.actions}>
      <button
        type="button"
        className={styles.delete}
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${documentName}`}
        title="Delete document"
      >
        <Trash2 size={13} />
      </button>
      {error ? <span className={styles.error}>{error}</span> : null}
    </span>
  );
}
