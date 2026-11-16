import { ButtonLink } from '@/components/ui/Button';
import styles from './ReviewSection.module.css';

export function ReviewSection() {
  return (
    <section className={styles.section} id="review">
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <p className="kicker">05 / Human review</p>
          <h2 className={styles.heading}>
            The model proposes.
            <br />
            <em className="serif">Your team decides.</em>
          </h2>
          <p className={styles.body}>
            Every extracted field keeps its original value, its normalised value and a confidence score. When someone
            corrects a field, the correction is stored separately and attributed to that person. Reprocessing the
            document keeps the edit and creates a new version — so an audit can reconstruct exactly what changed and
            when.
          </p>

          <ul className={styles.principles}>
            <li>
              <span>01</span>
              <div>
                <strong>Original values are never overwritten</strong>
                <p>Corrections sit beside the source, with the person and timestamp attached.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Totals are re-checked after every edit</strong>
                <p>Arithmetic validation follows the corrected value, not the original guess.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Retries do not duplicate the charge</strong>
                <p>Failed jobs can be replayed without creating a second billing event.</p>
              </div>
            </li>
          </ul>

          <ButtonLink href="/signup" variant="secondary" iconAfter={<span aria-hidden="true">↗</span>}>
            Open a review workspace
          </ButtonLink>
        </div>

        <div
          className={styles.workspace}
          role="img"
          aria-label="Illustrative review workspace. The source invoice shows a tax line of 312.40. A reviewer has corrected it to 318.20; the arithmetic is balanced and the edit is attributed."
        >
          <div aria-hidden="true">
            <div className={styles.source}>
              <div className={styles.sourceHead}>
                <span>Source / page 01</span>
                <span>INV-8842 · PDF</span>
              </div>
              <div className={styles.sourceDoc}>
                <p className={styles.sourceBrand}>Atlas Freight GmbH</p>
                <div className={styles.sourceRule} />
                <div className={styles.sourceTitleRow}>
                  <strong>Invoice</strong>
                  <span>14.10.2026</span>
                </div>
                <div className={styles.sourceMeta}>
                  <span>Bill to / Northwind Finance</span>
                  <span>Invoice no. / INV-8842</span>
                </div>
                <div className={styles.sourceLines}>
                  <div>
                    <span>Freight forwarding</span>
                    <span>3,120.00</span>
                  </div>
                  <div>
                    <span>Customs documentation</span>
                    <span>477.20</span>
                  </div>
                </div>
                <div className={styles.sourceTotals}>
                  <div>
                    <span>Subtotal</span>
                    <span>3,597.20</span>
                  </div>
                  <div className={styles.sourceHighlight}>
                    <span>VAT</span>
                    <span>312.40</span>
                  </div>
                  <div className={styles.sourceTotal}>
                    <span>Total EUR</span>
                    <span>3,915.40</span>
                  </div>
                </div>
                <div className={styles.sourceFoot}>
                  <span>Payment due within 30 days</span>
                  <span>1 / 2</span>
                </div>
              </div>
              <span className={styles.sourceTab}>OCR · native text · page image</span>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span>Review / INV-8842</span>
                <span>v03</span>
              </div>
              <div className={styles.panelTitleRow}>
                <h3>Review 2 fields</h3>
                <span className={styles.unresolved}>2 unresolved</span>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <span>Tax amount</span>
                  <span className={styles.conflict}>Arithmetic conflict</span>
                </div>
                <div className={styles.compare}>
                  <div>
                    <span>Extracted</span>
                    <strong className={styles.struck}>€312.40</strong>
                  </div>
                  <span className={styles.arrow}>→</span>
                  <div className={styles.edited}>
                    <span>Edited by M. Keller</span>
                    <strong>€318.20</strong>
                  </div>
                </div>
                <p className={styles.balance}>Subtotal €3,597.20 + tax €318.20 = total €3,915.40. Balanced.</p>
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <span>Due date</span>
                  <span className={styles.confidence}>Confidence 62%</span>
                </div>
                <div className={styles.dueRow}>
                  <strong>2026-11-14</strong>
                  <span className={styles.checkSource}>Check source</span>
                </div>
              </div>

              <div className={styles.panelFoot}>
                <span>Edit history recorded</span>
                <span className={styles.save}>Save review <b>↗</b></span>
              </div>
            </div>

            <div className={styles.queue}>
              <div className={styles.queueHead}>
                <span>Queue / 3 open</span>
                <span>Newest first</span>
              </div>
              <div className={styles.queueRow}>
                <span className={styles.queueDot} />
                <span>Atlas Freight GmbH</span>
                <span>2 fields</span>
                <span>INV-8842</span>
              </div>
              <div className={styles.queueRow}>
                <span className={styles.queueDot} />
                <span>Halcyon Media Ltd.</span>
                <span>1 field</span>
                <span>INV-8791</span>
              </div>
              <div className={styles.queueRow}>
                <span className={`${styles.queueDot} ${styles.queueDone}`} />
                <span>Meridian Supply Co.</span>
                <span>approved</span>
                <span>INV-8712</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
