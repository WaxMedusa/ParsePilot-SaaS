'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ensureCsrfToken } from '@/lib/client/csrf';
import { formatBytes } from '@/lib/format';
import styles from './UploadPanel.module.css';

type UploadState = {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  message?: string;
  documentId?: string;
  duplicateOf?: string | null;
};

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp';

type UploadResponse = {
  data?: {
    document?: { id: string; originalName: string };
    duplicateOf?: { id: string; name: string } | null;
  };
  error?: { message?: string };
};

export function UploadPanel({ workspaceId, compact = false }: { workspaceId: string; compact?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);

  const patchUpload = useCallback((id: string, patch: Partial<UploadState>) => {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const uploadFile = useCallback(
    async (file: File, id: string) => {
      const csrf = await ensureCsrfToken();
      const formData = new FormData();
      formData.append('file', file);

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/documents');
        xhr.withCredentials = true;
        xhr.setRequestHeader('accept', 'application/json');
        xhr.setRequestHeader('x-workspace-id', workspaceId);
        if (csrf) xhr.setRequestHeader('x-csrf-token', csrf);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.min(92, Math.round((event.loaded / event.total) * 92));
          patchUpload(id, { progress: percent });
        };

        xhr.onload = () => {
          let payload: UploadResponse | null = null;
          try {
            payload = JSON.parse(xhr.responseText) as UploadResponse;
          } catch {
            payload = null;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            const result = payload?.data;
            patchUpload(id, {
              status: 'done',
              progress: 100,
              documentId: result?.document?.id,
              message: result?.document ? 'Queued for processing' : 'Uploaded',
              duplicateOf: result?.duplicateOf?.name ?? null,
            });
          } else {
            patchUpload(id, {
              status: 'error',
              progress: 100,
              message: payload?.error?.message ?? 'The upload could not be accepted. Check the file and try again.',
            });
          }
          resolve();
        };

        xhr.onerror = () => {
          patchUpload(id, {
            status: 'error',
            progress: 100,
            message: 'The connection dropped during upload. Try the file again.',
          });
          resolve();
        };

        xhr.onabort = () => {
          patchUpload(id, { status: 'error', progress: 100, message: 'Upload cancelled.' });
          resolve();
        };

        xhr.send(formData);
      });
    },
    [patchUpload, workspaceId],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);

      const initial: UploadState[] = files.slice(0, 6).map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        size: file.size,
        status: 'uploading',
        progress: 0,
      }));
      setUploads((current) => [...initial, ...current].slice(0, 6));

      for (const [index, file] of files.slice(0, 6).entries()) {
        await uploadFile(file, initial[index].id);
      }

      busyRef.current = false;
      setBusy(false);
      router.refresh();
    },
    [router, uploadFile],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    void uploadFiles(Array.from(event.dataTransfer.files ?? []));
  };

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div
        className={`${styles.zone} ${dragging ? styles.dragging : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className={styles.mark} aria-hidden="true">
          +
        </span>
        <div className={styles.copy}>
          <p className={styles.title}>Add a document</p>
          <p className={styles.hint}>PDF, PNG, JPEG, TIFF or WebP · up to your plan&apos;s file limit</p>
          {busy ? <p className={styles.busy}>Uploading — progress is recorded per file below.</p> : null}
        </div>
        <button type="button" className={styles.choose} onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading' : 'Browse files'}
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
        <div className={styles.uploads} aria-live="polite">
          <div className={styles.listHead}>
            <span>Uploads / this session</span>
            <span>{uploads.filter((entry) => entry.status === 'done').length} queued</span>
          </div>
          <ul className={styles.list}>
            {uploads.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <div className={styles.itemTop}>
                  <span className={styles.itemName}>{entry.name}</span>
                  <span
                    className={`${styles.itemState} ${
                      entry.status === 'error' ? styles.itemError : entry.status === 'done' ? styles.itemDone : ''
                    }`}
                  >
                    {entry.status === 'uploading'
                      ? `Uploading ${entry.progress}%`
                      : entry.status === 'done'
                        ? 'Uploaded / queued'
                        : 'Not accepted'}
                  </span>
                </div>
                <div className={styles.track} aria-hidden="true">
                  <span
                    className={`${styles.fill} ${entry.status === 'error' ? styles.fillError : ''}`}
                    style={{ width: `${entry.progress}%` }}
                  />
                </div>
                <div className={styles.itemFoot}>
                  <span>{formatBytes(entry.size)}</span>
                  {entry.message ? <span className={entry.status === 'error' ? styles.messageError : styles.message}>{entry.message}</span> : null}
                  {entry.status === 'done' && entry.documentId ? (
                    <Link href={`/dashboard/documents/${entry.documentId}`} className={styles.openLink}>
                      View document ↗
                    </Link>
                  ) : null}
                </div>
                {entry.duplicateOf ? (
                  <p className={styles.duplicate}>Possible duplicate of {entry.duplicateOf}. Review both before export.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
