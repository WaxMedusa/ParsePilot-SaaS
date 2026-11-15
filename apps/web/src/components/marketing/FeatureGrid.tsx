import { FileSearch, GitBranch, ListChecks, Lock, RefreshCw, SlidersHorizontal } from 'lucide-react';
import styles from './FeatureGrid.module.css';

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Native text first, OCR when it is needed',
    body: 'Text layers are extracted directly from PDFs. Scanned pages fall through to OCR, so you are not paying for OCR on documents that never required it.',
  },
  {
    icon: ListChecks,
    title: 'Validation, not just extraction',
    body: 'Dates are normalised, currencies mapped to ISO codes, amounts parsed without floating point. Subtotal plus tax is checked against the stated total.',
  },
  {
    icon: GitBranch,
    title: 'Versioned results with surviving edits',
    body: 'Every run is a numbered extraction version. When a document is reprocessed, your manual corrections are carried forward instead of being overwritten.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Confidence and review queues',
    body: 'Low-confidence fields, missing totals and arithmetic conflicts move a document to needs review. Your team sees exactly which value is in question.',
  },
  {
    icon: RefreshCw,
    title: 'Reliable background processing',
    body: 'Jobs run in a Redis-backed worker with exponential backoff, heartbeats and dead-letter handling. A crashed worker never loses a document.',
  },
  {
    icon: Lock,
    title: 'Private storage and short-lived links',
    body: 'Files land in private object storage under random keys. Downloads are signed, expire in minutes, and require an authenticated workspace member.',
  },
];

export function FeatureGrid() {
  return (
    <section className={styles.section} id="product">
      <div className="container">
        <div className={styles.header}>
          <div>
            <p className="eyebrow">What it actually does</p>
            <h2 className={styles.heading}>
              Built for the messy middle
              <br />
              of document work.
            </h2>
          </div>
          <p className={styles.lede}>
            Extraction is the easy part to demo and the hard part to operate. ParsePilot is designed around the
            operational details: retries, duplicates, review, corrections and the audit trail that a finance team needs
            before it trusts a number.
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.icon}>
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className={styles.cardTitle}>{feature.title}</h3>
                <p className={styles.cardBody}>{feature.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
