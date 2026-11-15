import { ArrowRight, Check, CornerDownRight, History } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import styles from './ReviewSection.module.css';

export function ReviewSection() {
  return (
    <section className={styles.section}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Review, not blind trust</p>
          <h2 className={styles.heading}>
            The model proposes.
            <br />
            Your team decides.
          </h2>
          <p className={styles.body}>
            Every extracted field keeps its original value, its normalised value and a confidence score. When someone
            corrects a field, the correction is stored separately and attributed to that person. Reprocessing the
            document keeps the edit and creates a new version — so an audit can reconstruct exactly what changed and
            when.
          </p>
          <ul className={styles.list}>
            <li>
              <Check size={14} aria-hidden="true" />
              Original values are never overwritten
            </li>
            <li>
              <Check size={14} aria-hidden="true" />
              Totals are re-checked after every edit
            </li>
            <li>
              <Check size={14} aria-hidden="true" />
              Failed jobs can be retried without duplicate billing
            </li>
          </ul>
          <ButtonLink href="/signup" variant="secondary" iconAfter={<ArrowRight />}>
            Open a review workspace
          </ButtonLink>
        </div>

        <div className={styles.visual} aria-label="Illustration of the field review interface">
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.panelEyebrow}>Atlas Freight GmbH · INV-8842</p>
                <h3 className={styles.panelTitle}>Review 2 fields</h3>
              </div>
              <span className={styles.version}>
                <History size={12} /> v3
              </span>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHead}>
                <span className={styles.fieldLabel}>Tax amount</span>
                <span className={styles.conflict}>Arithmetic conflict</span>
              </div>
              <div className={styles.compare}>
                <div className={styles.compareCell}>
                  <span className={styles.compareLabel}>Extracted</span>
                  <span className={`${styles.compareValue} ${styles.struck}`}>€312.40</span>
                </div>
                <CornerDownRight size={14} className={styles.arrow} aria-hidden="true" />
                <div className={`${styles.compareCell} ${styles.edited}`}>
                  <span className={styles.compareLabel}>Edited by M. Keller</span>
                  <span className={styles.compareValue}>€318.20</span>
                </div>
              </div>
              <p className={styles.note}>Subtotal €3,597.20 + tax €318.20 = total €3,915.40. Balanced.</p>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHead}>
                <span className={styles.fieldLabel}>Due date</span>
                <span className={styles.confidence}>Confidence 62%</span>
              </div>
              <div className={styles.compare}>
                <div className={styles.compareCell}>
                  <span className={styles.compareLabel}>Normalised</span>
                  <span className={styles.compareValue}>2026-11-14</span>
                </div>
                <span className={`${styles.pill} ${styles.warn}`}>Check source</span>
              </div>
            </div>

            <div className={styles.panelFoot}>
              <span className={styles.footNote}>
                <Check size={12} /> Edit history recorded
              </span>
              <span className={styles.saveButton}>Save review</span>
            </div>
          </div>

          <div className={styles.queue}>
            <span className={styles.queueTitle}>Review queue</span>
            <div className={styles.queueRow}>
              <span className={styles.queueDot} />
              <span>Atlas Freight GmbH</span>
              <span className={styles.queueMeta}>2 fields</span>
            </div>
            <div className={styles.queueRow}>
              <span className={styles.queueDot} />
              <span>Halcyon Media Ltd.</span>
              <span className={styles.queueMeta}>1 field</span>
            </div>
            <div className={styles.queueRow}>
              <span className={`${styles.queueDot} ${styles.successDot}`} />
              <span>Meridian Supply Co.</span>
              <span className={styles.queueMeta}>approved</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
