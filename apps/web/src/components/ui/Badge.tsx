import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const STATUS_TONE: Record<string, BadgeTone> = {
  completed: 'success',
  needs_review: 'warning',
  failed: 'danger',
  queued: 'info',
  uploaded: 'neutral',
  extracting_text: 'primary',
  running_ocr: 'primary',
  extracting_fields: 'primary',
  validating: 'primary',
  detecting_duplicates: 'primary',
  succeeded: 'success',
  running: 'primary',
  dead_letter: 'danger',
  cancelled: 'neutral',
  expired: 'neutral',
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  canceled: 'danger',
  pending: 'info',
  processing: 'primary',
  rejected: 'danger',
};

export function statusTone(status: string): BadgeTone {
  return STATUS_TONE[status] ?? 'neutral';
}

export function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export function Badge({ children, tone = 'neutral', dot }: { children: ReactNode; tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={statusTone(status)} dot>
      {humanizeStatus(status)}
    </Badge>
  );
}
