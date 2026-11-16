import styles from './ProductPreview.module.css';

const FIELDS = [
  { label: 'Vendor', value: 'Atlas Freight GmbH', confidence: 97 },
  { label: 'Invoice number', value: 'INV-8842', confidence: 99 },
  { label: 'Issue date', value: '2026-10-14', confidence: 95 },
  { label: 'Subtotal', value: '€3,597.20', confidence: 94 },
  { label: 'Tax', value: '€318.20', confidence: 62, edited: true },
  { label: 'Total', value: '€3,915.40', confidence: 99 },
];

const LINES = [
  { label: 'Freight forwarding · 12 consignments', value: '3,120.00' },
  { label: 'Customs documentation', value: '477.20' },
];

export function ProductPreview() {
  return (
    <div
      className={styles.stage}
      role="img"
      aria-label="Illustrative ParsePilot workspace showing a PDF freight invoice and the extracted fields beside it. The tax field is marked as edited and the document is waiting for review."
    >
      <div aria-hidden="true">
        <div className={styles.stageMeta}>
          <span>Workspace / documents / INV-8842</span>
          <span className={styles.liveMark}>Live pipeline</span>
        </div>

        <div className={styles.composition}>
          <div className={styles.document}>
            <div className={styles.docHead}>
              <span>Atlas Freight GmbH</span>
              <span>PDF · 02</span>
            </div>
            <div className={styles.docRule} />
            <div className={styles.docTitleRow}>
              <p className={styles.docTitle}>Invoice</p>
              <div className={styles.docNumber}>
                <span>Invoice no.</span>
                <strong>INV-8842</strong>
              </div>
            </div>
            <div className={styles.docParties}>
              <div>
                <span>Billed to</span>
                <p>Northwind Finance<br />14 Harbour Street<br />Rotterdam, NL</p>
              </div>
              <div>
                <span>Issued</span>
                <p>14 October 2026<br />Due 14 November 2026</p>
              </div>
            </div>
            <div className={styles.lineItems}>
              <div className={styles.lineHead}>
                <span>Description</span>
                <span>Amount</span>
              </div>
              {LINES.map((line) => (
                <div key={line.label} className={styles.line}>
                  <span>{line.label}</span>
                  <span>{line.value}</span>
                </div>
              ))}
            </div>
            <div className={styles.totals}>
              <div>
                <span>Subtotal</span>
                <span>3,597.20</span>
              </div>
              <div>
                <span>VAT</span>
                <span>318.20</span>
              </div>
              <div className={styles.total}>
                <span>Total EUR</span>
                <span>3,915.40</span>
              </div>
            </div>
            <div className={styles.docFoot}>
              <span>Payment within 30 days</span>
              <span>Page 1 / 2</span>
            </div>
            <span className={styles.docTab}>SOURCE</span>
          </div>

          <div className={styles.extraction}>
            <div className={styles.exHead}>
              <span>Extraction / v03</span>
              <span className={styles.reviewStatus}><i /> Needs review</span>
            </div>
            <p className={styles.exTitle}>INV-8842 · freight invoice</p>

            <div className={styles.fieldList}>
              {FIELDS.map((field) => (
                <div key={field.label} className={`${styles.field} ${field.edited ? styles.fieldEdited : ''}`}>
                  <div className={styles.fieldTop}>
                    <span className={styles.fieldLabel}>{field.label}</span>
                    <span className={styles.confidence}>{field.confidence}%</span>
                  </div>
                  <div className={styles.valueRow}>
                    <span className={styles.value}>{field.value}</span>
                    <span className={styles.meter}>
                      <i style={{ width: `${field.confidence}%` }} />
                    </span>
                  </div>
                  {field.edited ? <span className={styles.editMark}>Corrected by M. Keller</span> : null}
                </div>
              ))}
            </div>

            <div className={styles.validation}>
              <span className={styles.validationLabel}>Arithmetic check</span>
              <span className={styles.validationValue}>Balanced</span>
              <span className={styles.validationMath}>3,597.20 + 318.20 = 3,915.40</span>
            </div>

            <div className={styles.exFoot}>
              <span>2 fields to confirm</span>
              <span className={styles.exAction}>Review queue <b>↗</b></span>
            </div>
          </div>
        </div>

        <div className={styles.stageFoot}>
          <span>Private object storage</span>
          <span>Version history preserved</span>
          <span>Export ready after review</span>
        </div>
      </div>
    </div>
  );
}
