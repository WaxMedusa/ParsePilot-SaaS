'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import { ensureCsrfToken } from '@/lib/client/csrf';
import { formatBytes } from '@/lib/format';
import styles from './UploadPanel.module.css';

type UploadState = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string | null;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  message?: string;
  documentId?: string;
  duplicateOf?: string | null;
};

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp';
const PREVIEWABLE = /^image\/(png|jpeg|webp)$/i;

type UploadResponse = {
  data?: {
    document?: { id: string; originalName: string };
    duplicateOf?: { id: string; name: string } | null;
  };
  error?: { message?: string };
};

export function UploadPanel({
  workspaceId,
  compact = false,
  maxUploadMb = 4,
}: {
  workspaceId: string;
  compact?: boolean;
  maxUploadMb?: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const dragDepth = useRef(0);
  const objectUrls = useRef<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);

  // Object URLs are the only client-side copy of a preview; release them when
  // the panel goes away so a long session does not leak blobs.
  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
      objectUrls.current = [];
    },
    [],
  );

  const patchUpload = useCallback((id: string, patch: Partial<UploadState>) => {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const dismiss = useCallback((id: string) => {
    setUploads((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
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
          const percent = Math.min(96, Math.round((event.loaded / event.total) * 96));
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
              message: result?.document ? 'Queued' : 'Uploaded',
              duplicateOf: result?.duplicateOf?.name ?? null,
            });
          } else {
            patchUpload(id, {
              status: 'error',
              progress: 100,
              message: payload?.error?.message ?? 'Not accepted. Check the file and try again.',
            });
          }
          resolve();
        };

        xhr.onerror = () => {
          patchUpload(id, { status: 'error', progress: 100, message: 'Connection dropped. Try that file again.' });
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

      const limitBytes = maxUploadMb * 1024 * 1024;
      const selected = files.slice(0, 8);

      const initial: UploadState[] = selected.map((file, index) => {
        const tooLarge = file.size > limitBytes;
        let previewUrl: string | null = null;
        if (PREVIEWABLE.test(file.type) && !tooLarge) {
          previewUrl = URL.createObjectURL(file);
          objectUrls.current.push(previewUrl);
        }
        return {
          id: `${Date.now()}-${index}-${file.name}`,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl,
          status: tooLarge ? 'error' : 'uploading',
          progress: tooLarge ? 100 : 0,
          message: tooLarge ? `Larger than the ${maxUploadMb} MB limit on this plan` : undefined,
        };
      });

      setUploads((current) => [...initial, ...current].slice(0, 8));

      for (const [index, file] of selected.entries()) {
        if (initial[index].status === 'error') continue;
        await uploadFile(file, initial[index].id);
      }

      busyRef.current = false;
      setBusy(false);
      router.refresh();
    },
    [maxUploadMb, router, uploadFile],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    void uploadFiles(Array.from(event.dataTransfer.files ?? []));
  };

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div
        className={`${styles.zone} ${dragging ? styles.dropping : ''} ${busy ? styles.busyZone : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (busy) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <span className={styles.glyph} aria-hidden="true">
          <ImageIcon size={16} />
        </span>
        <div className={styles.copy}>
          <p className={styles.title}>{dragging ? 'Drop to upload' : 'Drop documents here'}</p>
          <p className={styles.hint}>
            PDF, PNG, JPEG, TIFF or WebP · up to {maxUploadMb} MB each
          </p>
        </div>
        <button type="button" className={styles.choose} onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : 'Browse'}
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
            <span>This session</span>
            <span>
              {uploads.filter((entry) => entry.status === 'done').length} queued ·{' '}
              {uploads.filter((entry) => entry.status === 'error').length} rejected
            </span>
          </div>
          <ul className={styles.grid}>
            {uploads.map((entry, index) => (
              <li
                key={entry.id}
                className={`${styles.card} ${entry.status === 'error' ? styles.cardError : ''} ${
                  entry.status === 'done' ? styles.cardDone : ''
                }`}
                style={{ '--i': index } as React.CSSProperties}
              >
                <a
                  className={styles.thumb}
                  href={entry.previewUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={entry.previewUrl ? 0 : -1}
                  aria-label={entry.previewUrl ? `Open preview of ${entry.name}` : undefined}
                >
                  {entry.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.previewUrl} alt="" className={styles.thumbImage} />
                  ) : (
                    <span className={styles.thumbFallback} aria-hidden="true">
                      <FileText size={18} />
                    </span>
                  )}
                </a>

                <div className={styles.cardBody}>
                  <p className={styles.cardName} title={entry.name}>
                    {entry.name}
                  </p>
                  <p className={styles.cardMeta}>
                    <span>{formatBytes(entry.size)}</span>
                    <span
                      className={`${styles.state} ${entry.status === 'done' ? styles.stateDone : ''} ${
                        entry.status === 'error' ? styles.stateError : ''
                      }`}
                    >
                      {entry.status === 'uploading'
                        ? `${entry.progress}%`
                        : entry.status === 'done'
                          ? 'Queued'
                          : 'Rejected'}
                    </span>
                  </p>
                  <div className={styles.track} aria-hidden="true">
                    <span
                      className={`${styles.fill} ${entry.status === 'error' ? styles.fillError : ''}`}
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                  {entry.message && entry.status === 'error' ? <p className={styles.error}>{entry.message}</p> : null}
                  {entry.duplicateOf ? <p className={styles.duplicate}>May duplicate {entry.duplicateOf}</p> : null}
                  {entry.status === 'done' && entry.documentId ? (
                    <Link href={`/dashboard/documents/${entry.documentId}`} className={styles.open}>
                      Open ↗
                    </Link>
                  ) : null}
                </div>

                <button
                  type="button"
                  className={styles.dismiss}
                  onClick={() => dismiss(entry.id)}
                  aria-label={`Dismiss ${entry.name}`}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
