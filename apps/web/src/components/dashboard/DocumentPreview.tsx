import Link from 'next/link';
import styles from './DocumentPreview.module.css';

export function DocumentPreview({
  documentId,
  originalName,
  mimeType,
  pageCount,
}: {
  documentId: string;
  originalName: string;
  mimeType: string;
  pageCount: number | null;
}) {
  const previewUrl = `/api/v1/documents/${documentId}/preview`;
  const isPdf = mimeType === 'application/pdf';
  const isImage = /^image\/(png|jpeg|webp)$/i.test(mimeType);
  const displayable = isPdf || isImage;

  return (
    <section className={styles.section} aria-labelledby="source-document-title">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>Source / original document</p>
          <h2 id="source-document-title" className={styles.title}>
            {originalName}
          </h2>
        </div>
        <span className={styles.meta}>
          {pageCount ? `${pageCount} page${pageCount === 1 ? '' : 's'}` : '—'} · {mimeType.replace('application/', '').replace('image/', '').toUpperCase()}
        </span>
      </div>

      <div className={styles.frame}>
        {isPdf ? (
          <iframe
            src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
            title={`Preview of ${originalName}`}
            className={styles.pdf}
            loading="lazy"
          />
        ) : isImage ? (
          <img src={previewUrl} alt={`Original document ${originalName}`} className={styles.image} />
        ) : (
          <div className={styles.fallback}>
            <span className={styles.fallbackIndex}>Source</span>
            <p>This file type cannot be displayed inline. Download the original to inspect it.</p>
            <Link href={previewUrl} className={styles.fallbackLink} target="_blank" rel="noreferrer">
              Open original ↗
            </Link>
          </div>
        )}
      </div>

      <div className={styles.foot}>
        <span>Private object · authenticated session access</span>
        {displayable ? (
          <Link href={previewUrl} className={styles.openLink} target="_blank" rel="noreferrer">
            Open full size ↗
          </Link>
        ) : null}
      </div>
    </section>
  );
}
