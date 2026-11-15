import Link from 'next/link';
import { FileText } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { formatAmount, formatBytes, formatDate } from '@/lib/format';
import type { DocumentSummary } from '@/lib/documents/repository';
import styles from './Dashboard.module.css';

export function DocumentsTable({ documents, showEmpty = true }: { documents: DocumentSummary[]; showEmpty?: boolean }) {
  if (documents.length === 0 && showEmpty) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <FileText size={16} />
        </span>
        <p className={styles.emptyTitle}>No documents yet</p>
        <p className={styles.emptyBody}>
          Upload an invoice or receipt to start the pipeline. Native text is read first; OCR only runs on pages that need
          it.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Document</th>
            <th>Counterparty</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Pages</th>
            <th>Uploaded</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td>
                <div className={styles.cellMain}>
                  <Link href={`/dashboard/documents/${document.id}`} className={styles.cellTitle}>
                    {document.originalName}
                  </Link>
                  <span className={styles.cellSub}>
                    {document.kind} · {formatBytes(document.sizeBytes)}
                  </span>
                </div>
              </td>
              <td>
                <div className={styles.cellMain}>
                  <span className={styles.cellTitle}>{document.vendorName ?? '—'}</span>
                  <span className={styles.cellSub}>{document.documentNumber ?? document.id.slice(0, 8)}</span>
                </div>
              </td>
              <td className={styles.amount}>{document.totalAmount ? formatAmount(document.totalAmount, document.currency) : '—'}</td>
              <td>
                <div className={styles.cellMain} style={{ alignItems: 'flex-start', gap: 3 }}>
                  <StatusBadge status={document.status} />
                  {document.duplicateOfId ? <span className={styles.cellSub}>possible duplicate</span> : null}
                </div>
              </td>
              <td className={styles.amount}>{document.pageCount ?? '—'}</td>
              <td className={styles.amount}>{formatDate(document.createdAt)}</td>
              <td>
                <Link href={`/dashboard/documents/${document.id}`} className={styles.tag}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
