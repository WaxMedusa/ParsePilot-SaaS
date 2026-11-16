'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/client/api';
import styles from './StatusPoller.module.css';

type StatusResponse = {
  documentId: string;
  status: string;
  terminal: boolean;
  failure: { code: string; message: string } | null;
  job: { stage: string | null; attempts: number; maxAttempts: number; status: string } | null;
};

const STAGE_LABEL: Record<string, string> = {
  uploaded: 'Uploaded',
  queued: 'Queued for processing',
  extracting_text: 'Extracting native text',
  running_ocr: 'Running OCR',
  extracting_fields: 'Extracting structured fields',
  validating: 'Validating dates, amounts and totals',
  detecting_duplicates: 'Checking for duplicates',
  completed: 'Completed',
  needs_review: 'Needs review',
  failed: 'Failed',
};

export function StatusPoller({ documentId, workspaceId, initialStatus }: { documentId: string; workspaceId: string; initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [attempts, setAttempts] = useState<number | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let polls = 0;

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await apiRequest<StatusResponse>(`/api/v1/documents/${documentId}/status`, {
          workspaceId,
        });
        if (cancelled) return;
        setStatus(result.status);
        setAttempts(result.job?.attempts ?? null);
        if (result.terminal) {
          if (!refreshed.current) {
            refreshed.current = true;
            router.refresh();
          }
          return;
        }
      } catch {
        // Transient polling failure: keep the last known state and retry.
      }
      polls += 1;
      if (polls < 200) timer = window.setTimeout(poll, 3500);
    };

    timer = window.setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [documentId, router, workspaceId]);

  const terminal = ['completed', 'needs_review', 'failed'].includes(status);
  if (terminal) return null;

  return (
    <div className={styles.strip} role="status" aria-live="polite">
      <span className={styles.pulse} aria-hidden="true" />
      <span className={styles.label}>{STAGE_LABEL[status] ?? status.replace(/_/g, ' ')}</span>
      <span className={styles.meta}>
        {attempts !== null ? `attempt ${attempts}` : 'worker queued'} · updates automatically
      </span>
    </div>
  );
}
