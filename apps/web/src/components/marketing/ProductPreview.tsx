import {
  BarChart3,
  Check,
  ChevronDown,
  Download,
  FileText,
  Inbox,
  Layers,
  Search,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import styles from './ProductPreview.module.css';

const ROWS = [
  { vendor: 'Meridian Supply Co.', number: 'INV-2041', amount: '$12,480.00', status: 'completed', tone: 'success' },
  { vendor: 'Atlas Freight GmbH', number: 'INV-8842', amount: '€3,915.40', status: 'needs review', tone: 'warning' },
  { vendor: 'Northwind Utilities', number: 'UTIL-0925', amount: '$642.18', status: 'completed', tone: 'success' },
  { vendor: 'Cobalt Studio', number: 'INV-1190', amount: '$4,250.00', status: 'processing', tone: 'primary' },
];

const FIELDS = [
  { label: 'Vendor', value: 'Meridian Supply Co.', confidence: 'w98' },
  { label: 'Invoice number', value: 'INV-2041', confidence: 'w96' },
  { label: 'Issue date', value: '2026-10-04', confidence: 'w99' },
  { label: 'Subtotal', value: '$11,780.00', confidence: 'w94' },
  { label: 'Tax', value: '$700.00', confidence: 'w91' },
  { label: 'Total', value: '$12,480.00', confidence: 'w99' },
];

export function ProductPreview() {
  return (
    <div className={styles.stage} aria-label="Preview of the ParsePilot document workspace">
      <div className={styles.frame}>
        <div className={styles.frameBar}>
          <div className={styles.frameBrand}>
            <span className={styles.frameMark}>P</span>
            <span className={styles.frameWorkspace}>Northwind Finance</span>
            <ChevronDown size={13} className={styles.chevron} aria-hidden="true" />
          </div>
          <div className={styles.frameSearch}>
            <Search size={13} aria-hidden="true" />
            <span>Search vendor, number, amount</span>
          </div>
          <div className={styles.frameUser} aria-hidden="true">
            <span>MK</span>
          </div>
        </div>

        <div className={styles.frameBody}>
          <div className={styles.rail} aria-hidden="true">
            <div className={styles.railItems}>
              <span className={`${styles.railItem} ${styles.railActive}`}>
                <Inbox size={14} />
                Documents
              </span>
              <span className={styles.railItem}>
                <Layers size={14} />
                Jobs
                <span className={styles.railCount}>2</span>
              </span>
              <span className={styles.railItem}>
                <Download size={14} />
                Exports
              </span>
              <span className={styles.railItem}>
                <BarChart3 size={14} />
                Usage
              </span>
            </div>
            <span className={styles.railItem}>
              <ShieldCheck size={14} />
              Privacy
            </span>
          </div>

          <div className={styles.main}>
            <div className={styles.mainHead}>
              <div>
                <h3 className={styles.mainTitle}>Documents</h3>
                <p className={styles.mainMeta}>248 processed · 6 awaiting review</p>
              </div>
              <span className={styles.uploadPill}>Upload</span>
            </div>

            <div className={styles.filters} aria-hidden="true">
              <span className={styles.filterActive}>All</span>
              <span className={styles.filter}>Needs review</span>
              <span className={styles.filter}>Failed</span>
              <span className={styles.filterSpacer} />
              <span className={styles.filterMeta}>Updated 2m ago</span>
            </div>

            <div className={styles.table} role="presentation">
              <div className={styles.tableHead}>
                <span>Vendor</span>
                <span>Amount</span>
                <span>Status</span>
              </div>
              {ROWS.map((row) => (
                <div key={row.number} className={styles.tableRow}>
                  <span className={styles.vendorCell}>
                    <span className={styles.fileGlyph}>
                      <FileText size={13} />
                    </span>
                    <span className={styles.vendorText}>
                      <span className={styles.vendorName}>{row.vendor}</span>
                      <span className={styles.vendorNumber}>{row.number}</span>
                    </span>
                  </span>
                  <span className={`${styles.amount} mono`}>{row.amount}</span>
                  <span className={`${styles.status} ${styles[row.tone]}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.detail}>
            <div className={styles.detailHead}>
              <div>
                <p className={styles.detailEyebrow}>Extraction · v2</p>
                <h4 className={styles.detailTitle}>INV-2041.pdf</h4>
              </div>
              <span className={styles.detailCheck}>
                <Check size={12} />
              </span>
            </div>
            <div className={styles.fieldList}>
              {FIELDS.map((field) => (
                <div key={field.label} className={styles.field}>
                  <span className={styles.fieldLabel}>{field.label}</span>
                  <span className={styles.fieldRow}>
                    <span className={styles.fieldValue}>{field.value}</span>
                    <span className={styles.confidence} aria-hidden="true">
                      <span className={`${styles.confidenceFill} ${styles[field.confidence]}`} />
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.detailFoot}>
              <span className={styles.detailFootItem}>
                <Check size={12} /> Arithmetic validated
              </span>
              <span className={styles.detailFootItem}>4.2s</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.floatCard}>
        <span className={styles.floatIcon}>
          <Check size={13} />
        </span>
        <div className={styles.floatText}>
          <strong>Extraction complete</strong>
          <span>6 fields · 3 pages · queued export ready</span>
        </div>
      </div>

      <div className={styles.reviewCard}>
        <span className={styles.reviewIcon}>
          <AlertTriangle size={13} />
        </span>
        <div className={styles.floatText}>
          <strong>1 field needs review</strong>
          <span>Tax total differs from subtotal + tax</span>
        </div>
        <span className={styles.reviewAction}>Review</span>
      </div>
    </div>
  );
}
