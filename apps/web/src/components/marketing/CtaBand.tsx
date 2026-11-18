import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';
import styles from './CtaBand.module.css';

export function CtaBand() {
  return (
    <section className={styles.section}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.meta}>
          <span>09 / Begin</span>
          <span>One workspace / 100 free pages</span>
        </div>

        <div className={styles.grid}>
          <Reveal as="h2" className={styles.heading}>
            Give your finance team
            <br />
            <em className="serif">its afternoons back.</em>
          </Reveal>
          <Reveal className={styles.actions} delay={100}>
            <p className={styles.body}>
              Upload a batch of invoices, watch the pipeline run, and export reviewed data as CSV — or XLSX on paid
              plans. The free plan includes 100 pages — enough to judge the output on your own documents.
            </p>
            <ButtonLink href="/signup" variant="inverse" size="lg" iconAfter={<span aria-hidden="true">↗</span>}>
              Create your workspace
            </ButtonLink>
            <Link href="/pricing" className={styles.secondary}>
              See pricing <span aria-hidden="true">↗</span>
            </Link>
            <p className={styles.note}>No credit card. Documents deletable at any time.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
