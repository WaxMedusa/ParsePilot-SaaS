import { ScrollScene } from '@/components/motion/ScrollScene';
import styles from './Pipeline.module.css';

const STEPS = [
  {
    code: 'uploaded',
    title: 'Validate and store',
    body: 'Content-type detection, size limits, quarantine checks, then private storage under a random key.',
    log: 'POST /api/v1/documents · 201 · content-type verified',
  },
  {
    code: 'queued',
    title: 'Queue a job',
    body: 'A durable job row is committed and announced to the worker. Duplicate announces are detected by an active key.',
    log: 'job queued · attempt 1/5 · durable row committed',
  },
  {
    code: 'extracting_text',
    title: 'Extract native text',
    body: 'PyMuPDF reads the text layer page by page. Encrypted or malformed files fail with a categorised error.',
    log: 'pymupdf · page 1/2 · 41ms · 1,204 characters',
  },
  {
    code: 'running_ocr',
    title: 'OCR fallback',
    body: 'Pages without a usable text layer are rasterised and passed to the OCR engine, within a page budget.',
    log: 'ocr skipped · native text layer usable',
  },
  {
    code: 'extracting_fields',
    title: 'Structure the fields',
    body: 'A strict schema is extracted from the text as data. Instructions inside the document are never followed.',
    log: 'schema v7 · 6 fields claimed · 2 uncertain',
  },
  {
    code: 'validating',
    title: 'Validate and deduplicate',
    body: 'Dates, currencies and totals are normalised, arithmetic checked, and the document compared with earlier uploads.',
    log: 'arithmetic balanced · no duplicate found · v03',
  },
];

export function Pipeline() {
  return (
    <section className={styles.section} id="pipeline">
      <div className="container">
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <p className={`kicker ${styles.kicker}`}>04 / Processing pipeline</p>
            <span className={styles.headerNote}>Observable by default</span>
          </div>
          <div className={styles.headerGrid}>
            <h2 className={styles.heading}>
              Six stages.
              <br />
              <em className="serif">Every one observable.</em>
            </h2>
            <p className={styles.lede}>
              Status strings are shared by the web application, the worker and the API. That means the timeline your
              team sees is the actual job state, not a progress animation.
            </p>
          </div>
        </header>
      </div>

      <div className="container">
        <ScrollScene height="200vh" className={styles.scene}>
          <div className={styles.instrument}>
            <div className={styles.instrumentHead}>
              <div className={styles.instrumentId}>
                <span className={styles.instrumentLabel}>Job / 9f3c…a41e</span>
                <span className={styles.instrumentMeta}>v03 · worker eu-west-1</span>
              </div>
              <div className={styles.stateStack} aria-hidden="true">
                {STEPS.map((step, index) => (
                  <span key={step.code} className={styles.stateText} style={{ ['--i' as string]: index }}>
                    {step.code}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.rail} aria-hidden="true">
              {STEPS.map((step, index) => (
                <span key={step.code} className={styles.tick} style={{ ['--i' as string]: index }}>
                  <i className={styles.tickFill} />
                </span>
              ))}
            </div>

            <div className={styles.log} aria-hidden="true">
              {STEPS.map((step, index) => (
                <p key={step.code} className={styles.logLine} style={{ ['--i' as string]: index }}>
                  <span className={styles.logMark}>›</span>
                  {step.log}
                </p>
              ))}
            </div>
          </div>

          <ol className={styles.track}>
            {STEPS.map((step, index) => (
              <li key={step.code} className={styles.step} style={{ ['--i' as string]: index }}>
                <span className={styles.stepMarker} aria-hidden="true" />
                <div className={styles.stepTop}>
                  <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                  <code className={styles.code}>{step.code}</code>
                </div>
                <div className={styles.stepLine} aria-hidden="true" />
                <h3 className={styles.title}>{step.title}</h3>
                <p className={styles.body}>{step.body}</p>
              </li>
            ))}
          </ol>
        </ScrollScene>
      </div>

      <div className="container">
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
