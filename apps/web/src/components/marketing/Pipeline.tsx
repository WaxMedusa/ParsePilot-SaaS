import styles from './Pipeline.module.css';

const STEPS = [
  { code: 'uploaded', title: 'Validate and store', body: 'Content-type detection, size limits, quarantine checks, then private storage under a random key.' },
  { code: 'queued', title: 'Queue a job', body: 'A durable job row is committed and announced to the worker. Duplicate announces are detected by an active key.' },
  { code: 'extracting_text', title: 'Extract native text', body: 'PyMuPDF reads the text layer page by page. Encrypted or malformed files fail with a categorised error.' },
  { code: 'running_ocr', title: 'OCR fallback', body: 'Pages without a usable text layer are rasterised and passed to the OCR engine, within a page budget.' },
  { code: 'extracting_fields', title: 'Structure the fields', body: 'A strict schema is extracted from the text as data. Instructions inside the document are never followed.' },
  { code: 'validating', title: 'Validate and deduplicate', body: 'Dates, currencies and totals are normalised, arithmetic checked, and the document compared with earlier uploads.' },
];

export function Pipeline() {
  return (
    <section className={styles.section} id="pipeline">
      <div className="container">
        <div className={styles.header}>
          <p className="eyebrow">The processing pipeline</p>
          <h2 className={styles.heading}>Six stages. Every one of them observable.</h2>
          <p className={styles.lede}>
            Status strings are shared by the web application, the worker and the API. That means the timeline your team
            sees is the actual job state, not a progress animation.
          </p>
        </div>

        <ol className={styles.track}>
          {STEPS.map((step, index) => (
            <li key={step.code} className={styles.step}>
              <div className={styles.markerRow}>
                <span className={styles.marker}>{index + 1}</span>
                <span className={styles.connector} aria-hidden="true" />
              </div>
              <code className={styles.code}>{step.code}</code>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.body}>{step.body}</p>
            </li>
          ))}
        </ol>

        <div className={styles.footnote}>
          <span className={styles.footnoteLabel}>Failure policy</span>
          <p>
            Transient, provider, timeout and quota failures retry with exponential backoff up to the configured attempt
            limit. Permanent failures stop immediately. Exhausted jobs move to a dead-letter record and can be replayed
            from the dashboard without creating a second charge for the same job.
          </p>
        </div>
      </div>
    </section>
  );
}
