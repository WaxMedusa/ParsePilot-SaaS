import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { ProductPreview } from './ProductPreview';
import styles from './Hero.module.css';

const PROOF_POINTS = ['No credit card required', 'Private object storage', 'Delete documents anytime'];

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Document intelligence for finance teams</p>
          <h1 className={styles.headline}>
            Turn invoices into
            <br />
            data your team
            <br />
            can <span className={styles.accent}>trust.</span>
          </h1>
          <p className={styles.description}>
            ParsePilot reads native PDFs and scans, extracts line-item detail, validates the arithmetic, and routes
            anything uncertain to a human review queue. Every correction is versioned, and every value is traceable back
            to the source document.
          </p>
          <div className={styles.actions}>
            <ButtonLink href="/signup" size="lg" iconAfter={<ArrowRight />}>
              Start free — 100 pages
            </ButtonLink>
            <ButtonLink href="/#pipeline" variant="secondary" size="lg">
              See how it works
            </ButtonLink>
          </div>
          <ul className={styles.proof}>
            {PROOF_POINTS.map((point) => (
              <li key={point} className={styles.proofItem}>
                <Check size={13} aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <dl className={styles.metrics}>
            <div className={styles.metric}>
              <dt>Review workflow</dt>
              <dd>Field-level confidence and conflict checks before export</dd>
            </div>
            <div className={styles.metricDivider} aria-hidden="true" />
            <div className={styles.metric}>
              <dt>Built for audits</dt>
              <dd>Extraction versions, edit history and correlation IDs on every job</dd>
            </div>
          </dl>
        </div>
        <div className={styles.visual}>
          <ProductPreview />
          <p className={styles.caption}>
            <span className={styles.captionDot} aria-hidden="true" />
            Illustrative interface. Data shown is synthetic.
          </p>
        </div>
      </div>
    </section>
  );
}
