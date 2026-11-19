'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import { ensureCsrfToken } from '@/lib/client/csrf';
import { optimizeImage, savedPercent } from '@/lib/client/image-tools';
import { formatBytes } from '@/lib/format';
import styles from './UploadPanel.module.css';

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

type UploadState = {
  id: string;
  /** File name, or the path inside a dropped/selected folder. */
  name: string;
  size: number;
  type: string;
  previewUrl: string | null;
  status: UploadStatus;
  progress: number;
  /** Size before the browser re-encoded the image to WebP. */
  optimizedFrom?: number | null;
  message?: string;
  documentId?: string;
  duplicateOf?: string | null;
};

type PickedFile = { file: File; path: string };
type QueuedFile = { id: string; file: File };

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp';
const PREVIEWABLE = /^image\/(png|jpeg|webp)$/i;
const SUPPORTED_EXTENSION = /\.(pdf|png|jpe?g|tiff?|webp)$/i;
const SUPPORTED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/webp']);

/** Files queued from a single pick or drop; a larger folder is split by the user. */
const MAX_BATCH = 200;
/** Cards kept in the panel, so a long session does not grow without bound. */
const MAX_SESSION = 300;
/** Parallel uploads: enough to overlap network latency without hammering the API. */
const CONCURRENCY = 3;
/** Guards against pathological or deeply linked folder trees. */
const MAX_FOLDER_DEPTH = 8;

/** `webkitdirectory` is not part of React's input typings. */
const directoryPickerProps = { webkitdirectory: '' } as unknown as React.InputHTMLAttributes<HTMLInputElement>;

type UploadResponse = {
  data?: {
    document?: { id: string; originalName: string };
    duplicateOf?: { id: string; name: string } | null;
  };
  error?: { message?: string };
};

function isIgnoredPath(path: string): boolean {
  // Hidden files and folders (.DS_Store, .git, __MACOSX-style caches) are noise.
  return path.split('/').some((segment) => segment.startsWith('.'));
}

function isSupported(file: File, path: string): boolean {
  return SUPPORTED_EXTENSION.test(path) || SUPPORTED_TYPES.has(file.type.toLowerCase());
}

/**
 * `readEntries` hands back at most 100 entries per call and an empty array at
 * the end, so a single call would silently miss files in a large folder.
 */
async function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const found: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(
        (entries) => resolve(entries),
        () => resolve([]),
      );
    });
    if (batch.length === 0) break;
    found.push(...batch);
    if (found.length >= 5000) break;
  }
  return found;
}

async function walkEntry(entry: FileSystemEntry, path: string, out: PickedFile[], depth = 0): Promise<void> {
  if (depth > MAX_FOLDER_DEPTH) return;

  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => {
      (entry as FileSystemFileEntry).file(
        (result) => resolve(result),
        () => resolve(null),
      );
    });
    if (file) out.push({ file, path });
    return;
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAllDirectoryEntries(reader);
    await Promise.all(children.map((child) => walkEntry(child, `${path}/${child.name}`, out, depth + 1)));
  }
}

/** Flattens a drop of loose files, a folder, or several of each. */
async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<PickedFile[]> {
  // webkitGetAsEntry must be read synchronously, before any await.
  const rootEntries = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (rootEntries.length === 0) {
    return Array.from(dataTransfer.files ?? []).map((file) => ({ file, path: file.name }));
  }

  const collected: PickedFile[] = [];
  await Promise.all(rootEntries.map((entry) => walkEntry(entry, entry.name, collected)));
  return collected;
}

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
  const folderRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const dragDepth = useRef(0);
  const objectUrls = useRef<string[]>([]);
  const queueRef = useRef<QueuedFile[]>([]);
  const activeRef = useRef(0);
  const pumpRef = useRef<() => void>(() => {});
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
              duplicateOf: result?.duplicateOf?.name ?? null,
            });
          } else {
            patchUpload(id, {
              status: 'error',
              progress: 0,
              message: payload?.error?.message ?? 'Not accepted. Check the file and try again.',
            });
          }
          resolve();
        };

        xhr.onerror = () => {
          patchUpload(id, { status: 'error', progress: 0, message: 'Connection dropped. Try that file again.' });
          resolve();
        };

        xhr.send(formData);
      });
    },
    [patchUpload, workspaceId],
  );

  /**
   * Drains the queue, keeping CONCURRENCY requests in flight. Each finished
   * file starts the next one; when the queue and the pool are both empty the
   * batch is complete and the server components refresh once.
   */
  const startQueuedUploads = useCallback(() => {
    while (activeRef.current < CONCURRENCY) {
      const next = queueRef.current.shift();
      if (!next) break;
      activeRef.current += 1;
      patchUpload(next.id, { status: 'uploading', progress: 2 });

      void (async () => {
        try {
          // Shrink images in the browser: a phone photo becomes a fraction of
          // its size before it ever touches the network or our storage.
          const prepared = await optimizeImage(next.file, { maxDimension: 2200, quality: 0.82 });
          if (prepared.changed) {
            patchUpload(next.id, {
              size: prepared.optimizedBytes,
              optimizedFrom: prepared.originalBytes,
              type: 'image/webp',
            });
          }
          await uploadFile(prepared.file, next.id);
        } catch {
          patchUpload(next.id, { status: 'error', progress: 0, message: 'Could not prepare this file. Try again.' });
        } finally {
          activeRef.current -= 1;
          if (queueRef.current.length === 0 && activeRef.current === 0 && busyRef.current) {
            busyRef.current = false;
            setBusy(false);
            router.refresh();
          }
          pumpRef.current();
        }
      })();
    }
  }, [patchUpload, router, uploadFile]);

  useEffect(() => {
    pumpRef.current = startQueuedUploads;
  }, [startQueuedUploads]);

  const enqueue = useCallback(
    (picked: PickedFile[]) => {
      const limitBytes = maxUploadMb * 1024 * 1024;
      const supported: PickedFile[] = [];
      let ignored = 0;

      for (const item of picked) {
        if (isIgnoredPath(item.path)) continue;
        if (!isSupported(item.file, item.path)) {
          ignored += 1;
          continue;
        }
        supported.push(item);
      }

      const selected = supported.slice(0, MAX_BATCH);
      const overflow = supported.length - selected.length;
      const stamp = Date.now();
      const initial: UploadState[] = [];
      const queued: QueuedFile[] = [];

      selected.forEach((item, index) => {
        const id = `${stamp}-${index}-${item.path}`;
        const tooLarge = item.file.size > limitBytes;
        let previewUrl: string | null = null;
        if (PREVIEWABLE.test(item.file.type) && !tooLarge) {
          previewUrl = URL.createObjectURL(item.file);
          objectUrls.current.push(previewUrl);
        }
        initial.push({
          id,
          name: item.path,
          size: item.file.size,
          type: item.file.type,
          previewUrl,
          status: tooLarge ? 'error' : 'queued',
          progress: 0,
          message: tooLarge ? `Larger than the ${maxUploadMb} MB limit on this plan` : undefined,
        });
        if (!tooLarge) queued.push({ id, file: item.file });
      });

      const notes: string[] = [];
      if (ignored > 0) {
        notes.push(`${ignored} unsupported file${ignored === 1 ? '' : 's'} skipped (PDF, PNG, JPEG, TIFF or WebP only).`);
      }
      if (overflow > 0) {
        notes.push(
          `${overflow} more file${overflow === 1 ? '' : 's'} not queued; a batch holds up to ${MAX_BATCH}. Drop the rest as a second batch.`,
        );
      }
      setNotice(notes.length > 0 ? notes.join(' ') : null);

      if (initial.length === 0) return;
      setUploads((current) => [...initial, ...current].slice(0, MAX_SESSION));

      if (queued.length > 0) {
        busyRef.current = true;
        setBusy(true);
        queueRef.current.push(...queued);
        pumpRef.current();
      }
    },
    [maxUploadMb],
  );

  const onPick = useCallback(
    (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      enqueue(files.map((file) => ({ file, path: file.webkitRelativePath || file.name })));
    },
    [enqueue],
  );

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    setScanning(true);
    try {
      enqueue(await collectDroppedFiles(event.dataTransfer));
    } finally {
      setScanning(false);
    }
  };

  const uploaded = uploads.filter((entry) => entry.status === 'done').length;
  const rejected = uploads.filter((entry) => entry.status === 'error').length;
  const waiting = uploads.filter((entry) => entry.status === 'queued' || entry.status === 'uploading').length;
  const batchProgress =
    uploads.length === 0
      ? 0
      : Math.round(
          uploads.reduce((sum, entry) => sum + (entry.status === 'error' ? 0 : entry.progress), 0) / uploads.length,
        );

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div
        className={`${styles.zone} ${dragging ? styles.dropping : ''} ${busy ? styles.busyZone : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
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
          <p className={styles.title}>{dragging ? 'Drop to upload' : 'Drop documents or a folder here'}</p>
          <p className={styles.hint}>
            {scanning
              ? 'Reading folder…'
              : `PDF, PNG, JPEG, TIFF or WebP · up to ${maxUploadMb} MB each · folders and batches welcome`}
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.choose} onClick={() => inputRef.current?.click()} disabled={scanning}>
            {busy ? 'Add files' : 'Browse'}
          </button>
          <button type="button" className={styles.choose} onClick={() => folderRef.current?.click()} disabled={scanning}>
            Folder
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className={styles.input}
          onChange={(event) => {
            onPick(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={folderRef}
          type="file"
          accept={ACCEPT}
          multiple
          className={styles.input}
          {...directoryPickerProps}
          onChange={(event) => {
            onPick(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {uploads.length > 0 ? (
        <div className={styles.uploads} aria-live="polite">
          <div className={styles.listHead}>
            <span>{busy ? 'Uploading batch' : 'This session'}</span>
            <span>
              {uploaded} uploaded · {rejected} rejected
              {waiting > 0 ? ` · ${waiting} waiting` : ''}
            </span>
          </div>
          {busy ? (
            <div
              className={styles.batchTrack}
              role="progressbar"
              aria-label="Batch upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={batchProgress}
            >
              <span className={styles.batchFill} style={{ width: `${batchProgress}%` }} />
            </div>
          ) : null}
          {notice ? <p className={styles.notice}>{notice}</p> : null}
          <ul className={styles.grid}>
            {uploads.map((entry, index) => (
              <li
                key={entry.id}
                className={`${styles.card} ${entry.status === 'error' ? styles.cardError : ''} ${
                  entry.status === 'done' ? styles.cardDone : ''
                }`}
                style={{ '--i': Math.min(index, 12) } as React.CSSProperties}
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
                    {entry.optimizedFrom ? (
                      <span className={styles.savings} title={`Was ${formatBytes(entry.optimizedFrom)}`}>
                        −{savedPercent(entry.optimizedFrom, entry.size)}%
                      </span>
                    ) : null}
                    <span
                      className={`${styles.state} ${entry.status === 'done' ? styles.stateDone : ''} ${
                        entry.status === 'error' ? styles.stateError : ''
                      }`}
                    >
                      {entry.status === 'uploading'
                        ? `${entry.progress}%`
                        : entry.status === 'done'
                          ? 'Uploaded'
                          : entry.status === 'queued'
                            ? 'Waiting'
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
