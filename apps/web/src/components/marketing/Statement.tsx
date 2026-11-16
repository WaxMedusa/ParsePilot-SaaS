import styles from './Statement.module.css';

export function Statement() {
  return (
    <section className={styles.section}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.margin}>
          <p className={`kicker ${styles.kicker}`}>02 / The real problem</p>
          <p className={styles.marginNote}>The exception is the work.</p>
        </div>
        <div className={styles.content}>
          <h2 className={styles.heading}>
            Extraction is the demo.
            <br />
            <em className="serif">Trust is the work.</em>
          </h2>
          <div className={styles.bodyGrid}>
            <p>
              Most document tools stop at a confident guess. Finance teams inherit the exceptions: the missing tax
              amount, the duplicate invoice, the field that changed after someone corrected it.
            </p>
            <p>
              ParsePilot is designed around those moments. Every value keeps its source, every correction is attributed,
              and every decision stays visible to the next person who opens the document.
            </p>
          </div>
          <div className={styles.principles}>
            <div>
              <span>01</span>
              <p>A value</p>
              <small>Normalised, typed and checked</small>
            </div>
            <div>
              <span>02</span>
              <p>A source</p>
              <small>Traceable back to the page</small>
            </div>
            <div>
              <span>03</span>
              <p>A decision</p>
              <small>Reviewed, attributed, versioned</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
