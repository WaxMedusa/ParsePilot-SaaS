import { ArrowRight, FileKey2, KeyRound, LockKeyhole, ScrollText } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import styles from './TrustSection.module.css';

const CONTROLS = [
  {
    icon: LockKeyhole,
    title: 'Private by default',
    body: 'No public buckets, no permanent links. Documents are streamed through short-lived signed URLs after an authorization check.',
  },
  {
    icon: KeyRound,
    title: 'Sessions, not shared secrets',
    body: 'Passwords are hashed with scrypt. Sessions are opaque tokens stored as hashes, revocable per device and cleared by password reset.',
  },
  {
    icon: FileKey2,
    title: 'Tenant isolation in every query',
    body: 'Document, job, export and billing reads are filtered by workspace membership. A workspace id from the client is verified, never trusted.',
  },
  {
    icon: ScrollText,
    title: 'Audit trail for sensitive actions',
    body: 'Uploads, edits, deletions, downloads, retries and billing events are recorded with correlation IDs for investigation.',
  },
];

export function TrustSection() {
  return (
    <section className={styles.section}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Security and privacy</p>
          <h2 className={styles.heading}>
            Document data is sensitive.
            <br />
            We treat it that way.
          </h2>
          <p className={styles.body}>
            ParsePilot handles invoices, vendor records and payment details. The security page describes exactly what is
            implemented today — including what is not. There are no invented certifications on this site.
          </p>
          <div className={styles.actions}>
            <ButtonLink href="/security" variant="inverse" iconAfter={<ArrowRight />}>
              Read the security page
            </ButtonLink>
            <ButtonLink href="/subprocessors" variant="ghost" className={styles.ghost}>
              See subprocessors
            </ButtonLink>
          </div>
        </div>
        <div className={styles.grid}>
          {CONTROLS.map((control) => {
            const Icon = control.icon;
            return (
              <div key={control.title} className={styles.control}>
                <span className={styles.icon}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <h3 className={styles.controlTitle}>{control.title}</h3>
                <p className={styles.controlBody}>{control.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
