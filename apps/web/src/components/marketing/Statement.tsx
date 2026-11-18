import { Reveal } from '@/components/motion/Reveal';
import styles from './Statement.module.css';

export function Statement() {
  return (
    <section className={styles.section}>
      <div className={`container ${styles.grid}`}>
        <Reveal className={styles.margin}>
          <p className={`kicker ${styles.kicker}`}>02 / The real problem</p>
          <p className={styles.marginNote}>The exception is the work.</p>
        </Reveal>
        <div className={styles.content}>
          <Reveal as="h2" className={styles.heading}>
            Extraction is the demo.
            <br />
            <em className="serif">Trust is the work.</em>
          </Reveal>
          <Reveal className={styles.bodyGrid} delay={90}>
            <p>
              Most document tools stop at a confident guess. Finance teams inherit the exceptions: the missing tax
              amount, the duplicate invoice, the field that changed after someone corrected it.
            </p>
            <p>
              ParsePilot is designed around those moments. Every value keeps its source, every correction is attributed,
              and every decision stays visible to the next person who opens the document.
            </p>
          </Reveal>
          <Reveal className={styles.principles} delay={160}>
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
          </Reveal>
        </div>
      </div>
    </section>
  );
}
