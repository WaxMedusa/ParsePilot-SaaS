import { Reveal } from '@/components/motion/Reveal';
import styles from './FeatureGrid.module.css';

const FEATURES = [
  {
    index: '01',
    meta: 'Input',
    title: 'Native text first, OCR when it is needed',
    body: 'Text layers are extracted directly from PDFs. Scanned pages fall through to OCR, so you are not paying for OCR on documents that never required it.',
  },
  {
    index: '02',
    meta: 'Validation',
    title: 'Validation, not just extraction',
    body: 'Dates are normalised, currencies mapped to ISO codes, amounts parsed without floating point. Subtotal plus tax is checked against the stated total.',
  },
  {
    index: '03',
    meta: 'History',
    title: 'Versioned results with surviving edits',
    body: 'Every run is a numbered extraction version. When a document is reprocessed, your manual corrections are carried forward instead of being overwritten.',
  },
  {
    index: '04',
    meta: 'Review',
    title: 'Confidence and review queues',
    body: 'Low-confidence fields, missing totals, arithmetic conflicts and suspected duplicates move a document to needs review. Your team sees exactly which value is in question.',
  },
  {
    index: '05',
    meta: 'Reliability',
    title: 'Reliable background processing',
    body: 'Jobs are durable database rows with exponential backoff, heartbeats and dead-letter handling. A crashed worker never loses a document.',
  },
  {
    index: '06',
    meta: 'Storage',
    title: 'Private storage and short-lived links',
    body: 'Files land in private object storage under random keys. Downloads are signed, expire in minutes, and require an authenticated workspace member.',
  },
];

export function FeatureGrid() {
  return (
    <section className={styles.section} id="product">
      <div className="container">
        <header className={styles.header}>
          <p className="kicker">03 / The operating layer</p>
          <div className={styles.headerGrid}>
            <Reveal as="h2" className={styles.heading}>
              Built for the <em className="serif">messy middle</em>
              <br />
              of document work.
            </Reveal>
            <Reveal className={styles.headerCopy} delay={90}>
              <p>
                Extraction is the easy part to demo and the hard part to operate. ParsePilot is designed around the
                operational details: retries, duplicates, review, corrections and the audit trail that a finance team
                needs before it trusts a number.
              </p>
              <span className={styles.headerNote}>Six capabilities / one system of record</span>
            </Reveal>
          </div>
        </header>

        <div className={styles.ledger}>
          {FEATURES.map((feature, index) => (
            <Reveal as="article" key={feature.index} className={styles.row} delay={index * 55}>
              <span className={styles.index}>{feature.index}</span>
              <h3 className={styles.title}>{feature.title}</h3>
              <p className={styles.body}>{feature.body}</p>
              <span className={styles.meta}>{feature.meta}</span>
            </Reveal>
          ))}
        </div>

        <Reveal className={styles.closing} delay={80}>
          <p>One pipeline records the value, the source and the decision.</p>
          <span>No black boxes / no silent overwrites</span>
        </Reveal>
      </div>
    </section>
  );
}
