import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { ProductPreview } from './ProductPreview';
import styles from './Hero.module.css';

const PROOF = [
  {
    index: '01',
    title: 'Native text first',
    body: 'Read the PDF text layer. OCR only on pages that genuinely need it.',
  },
  {
    index: '02',
    title: 'Built for review',
    body: 'Confidence, corrections and arithmetic checks before anything is exported.',
  },
  {
    index: '03',
    title: 'Auditable by design',
    body: 'Versioned extractions, attributed edits and a durable processing record.',
  },
];

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.meta}>
          <p className="kicker">Document intelligence / 01</p>
          <p className={styles.metaNote}>For finance and operations teams</p>
        </div>

        <div className={styles.copy}>
          <h1 className={styles.headline}>
            <span className={styles.line}>
              <span className={styles.lineInner}>Turn invoices</span>
            </span>
            <span className={styles.line}>
              <span className={styles.lineInner}>into data your team</span>
            </span>
            <span className={styles.line}>
              <span className={styles.lineInner}>
                can <em className="serif">trust.</em>
              </span>
            </span>
          </h1>
          <p className={`${styles.description} rise-in rise-in-delay-1`}>
            ParsePilot reads native PDFs and scans, extracts line-item detail, validates the arithmetic, and routes
            anything uncertain to a human review queue. Every correction is versioned, and every value is traceable
            back to the source document.
          </p>
          <div className={`${styles.actions} rise-in rise-in-delay-2`}>
            <ButtonLink href="/signup" size="lg" iconAfter={<span aria-hidden="true">↗</span>}>
              Start free — 100 pages
            </ButtonLink>
            <Link href="/#pipeline" className={styles.textLink}>
              See the pipeline <span aria-hidden="true">↓</span>
            </Link>
          </div>
          <p className={`${styles.finePrint} rise-in rise-in-delay-3`}>
            No credit card. Private storage. Delete documents at any time.
          </p>
        </div>

        <div className={`${styles.visual} rise-in rise-in-delay-2`}>
          <ProductPreview />
          <div className={styles.caption}>
            <span>Illustrative workspace</span>
            <span>Synthetic document data</span>
          </div>
        </div>

        <div className={styles.proof}>
          {PROOF.map((item) => (
            <div key={item.index} className={styles.proofItem}>
              <span className={styles.proofIndex}>{item.index}</span>
              <div>
                <p className={styles.proofTitle}>{item.title}</p>
                <p className={styles.proofBody}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
