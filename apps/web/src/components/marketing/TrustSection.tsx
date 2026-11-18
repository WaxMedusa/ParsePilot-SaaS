import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';
import styles from './TrustSection.module.css';

const CONTROLS = [
  {
    index: '01',
    title: 'Private by default',
    body: 'No public buckets, no permanent links. Documents are streamed through short-lived signed URLs after an authorization check.',
  },
  {
    index: '02',
    title: 'Sessions, not shared secrets',
    body: 'Passwords are hashed with scrypt. Sessions are opaque tokens stored as hashes, revocable per device and cleared by password reset.',
  },
  {
    index: '03',
    title: 'Tenant isolation in every query',
    body: 'Document, job, export and billing reads are filtered by workspace membership. A workspace id from the client is verified, never trusted.',
  },
  {
    index: '04',
    title: 'Audit trail for sensitive actions',
    body: 'Uploads, edits, deletions, downloads, retries and billing events are recorded with correlation IDs for investigation.',
  },
];

export function TrustSection() {
  return (
    <section className={styles.section} id="security">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={`kicker ${styles.kicker}`}>07 / Security and privacy</p>
          <Reveal as="h2" className={styles.heading}>
            Document data is sensitive.
            <br />
            <em className="serif">We treat it that way.</em>
          </Reveal>
          <Reveal as="p" className={styles.body} delay={70}>
            ParsePilot handles invoices, vendor records and payment details. The security page describes exactly what is
            implemented today — including what is not. There are no invented certifications on this site.
          </Reveal>
          <Reveal className={styles.actions} delay={120}>
            <ButtonLink href="/security" variant="inverse" iconAfter={<span aria-hidden="true">↗</span>}>
              Read the security page
            </ButtonLink>
            <Link href="/subprocessors" className={styles.textLink}>
              See subprocessors
            </Link>
          </Reveal>
          <Reveal as="p" className={styles.note} delay={160}>
            No badges. No unearned claims. Just the controls we can point to.
          </Reveal>
        </div>

        <div className={styles.controls}>
          {CONTROLS.map((control, index) => (
            <Reveal as="article" key={control.index} className={styles.control} delay={index * 70}>
              <span className={styles.index}>{control.index}</span>
              <div>
                <h3 className={styles.controlTitle}>{control.title}</h3>
                <p className={styles.controlBody}>{control.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
