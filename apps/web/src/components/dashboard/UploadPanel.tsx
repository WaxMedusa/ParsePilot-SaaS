'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './UploadPanel.module.css';

type UploadState = { name: string; status: 'uploading' | 'done' | 'error'; message?: string };

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp';

export function UploadPanel({ workspaceId, compact = false }: { workspaceId: string; compact?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      const initial = files.map((file) => ({ name: file.name, status: 'uploading' as const }));
      setUploads((current) => [...initial, ...current].slice(0, 6));

      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          await apiRequest('/api/v1/documents', { method: 'POST', body: formData, workspaceId });
          setUploads((current) =>
            current.map((entry) => (entry.name === file.name && entry.status === 'uploading' ? { ...entry, status: 'done' } : entry)),
          );
        } catch (error) {
          setUploads((current) =>
            current.map((entry) =>
              entry.name === file.name && entry.status === 'uploading' ? { ...entry, status: 'error', message: errorMessage(error) } : entry,
            ),
          );
        }
      }
      setBusy(false);
      router.refresh();
    },
    [router, workspaceId],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    void uploadFiles(files);
  };

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div
        className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className={styles.icon}>
          <FileUp size={18} />
        </span>
        <div className={styles.copy}>
          <p className={styles.title}>Drop a document or choose a file</p>
          <p className={styles.hint}>PDF, PNG, JPEG, TIFF or WebP · up to your plan&apos;s file-size limit</p>
        </div>
        <button type="button" className={styles.choose} onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className={styles.spinner} /> : <Upload size={14} />}
          {busy ? 'Uploading' : 'Choose file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className={styles.input}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void uploadFiles(files);
            event.target.value = '';
          }}
        />
      </div>

      {uploads.length > 0 ? (
        <ul className={styles.list}>
          {uploads.map((entry, index) => (
            <li key={`${entry.name}-${index}`} className={styles.item}>
              {entry.status === 'uploading' ? <Loader2 size={12} className={styles.spinner} /> : null}
              {entry.status === 'done' ? <CheckCircle2 size={12} className={styles.ok} /> : null}
              {entry.status === 'error' ? <AlertCircle size={12} className={styles.err} /> : null}
              <span className={styles.itemName}>{entry.name}</span>
              <span className={entry.status === 'error' ? styles.errText : styles.statusText}>
                {entry.status === 'uploading' ? 'Queued for processing…' : entry.status === 'done' ? 'Uploaded · processing queued' : entry.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
