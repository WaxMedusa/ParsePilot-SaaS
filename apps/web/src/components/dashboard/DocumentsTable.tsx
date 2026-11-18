import Link from 'next/link';
import { FileText } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { formatAmount, formatBytes, formatDate } from '@/lib/format';
import type { DocumentSummary } from '@/lib/documents/repository';
import { DocumentRowActions } from './DocumentRowActions';
import styles from './Dashboard.module.css';
import rowStyles from './DocumentsTable.module.css';

export function DocumentsTable({
  documents,
  workspaceId,
  showEmpty = true,
}: {
  documents: DocumentSummary[];
  workspaceId: string;
  showEmpty?: boolean;
}) {
  if (documents.length === 0 && showEmpty) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <FileText size={16} />
        </span>
        <p className={styles.emptyTitle}>No documents yet</p>
        <p className={styles.emptyBody}>Drop a file above to start the first run.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.documentsTable}`}>
        <thead>
          <tr>
            <th>Document</th>
            <th>Counterparty</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Pages</th>
            <th>Uploaded</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td data-label="Document">
                <div className={styles.cellMain}>
                  <Link href={`/dashboard/documents/${document.id}`} className={styles.cellTitle}>
                    {document.originalName}
                  </Link>
                  <span className={styles.cellSub}>
                    {document.kind} · {formatBytes(document.sizeBytes)}
                  </span>
                </div>
              </td>
              <td data-label="Counterparty">
                <div className={styles.cellMain}>
                  <span className={styles.cellTitle}>{document.vendorName ?? '—'}</span>
                  <span className={styles.cellSub}>{document.documentNumber ?? document.id.slice(0, 8)}</span>
                </div>
              </td>
              <td data-label="Amount" className={styles.amount}>
                {document.totalAmount ? formatAmount(document.totalAmount, document.currency) : '—'}
              </td>
              <td data-label="Status">
                <div className={styles.cellMain} style={{ alignItems: 'flex-start', gap: 3 }}>
                  <StatusBadge status={document.status} />
                  {document.duplicateOfId ? <span className={styles.cellSub}>possible duplicate</span> : null}
                </div>
              </td>
              <td data-label="Pages" className={styles.amount}>
                {document.pageCount ?? '—'}
              </td>
              <td data-label="Uploaded" className={styles.amount}>
                {formatDate(document.createdAt)}
              </td>
              <td>
                <div className={rowStyles.actions}>
                  <Link href={`/dashboard/documents/${document.id}`} className={styles.tag}>
                    Open
                  </Link>
                  <DocumentRowActions
                    documentId={document.id}
                    workspaceId={workspaceId}
                    documentName={document.originalName}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
