import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import styles from './CtaBand.module.css';

export function CtaBand() {
  return (
    <section className={styles.section}>
      <div className={`container ${styles.inner}`}>
        <div>
          <h2 className={styles.heading}>Give your finance team its afternoons back.</h2>
          <p className={styles.body}>
            Upload a batch of invoices, watch the pipeline run, and export reviewed data as CSV or XLSX. The free plan
            includes 100 pages — enough to judge the output on your own documents.
          </p>
        </div>
        <div className={styles.actions}>
          <ButtonLink href="/signup" variant="inverse" size="lg" iconAfter={<ArrowRight />}>
            Create your workspace
          </ButtonLink>
          <ButtonLink href="/pricing" variant="ghost" size="lg" className={styles.ghost}>
            See pricing
          </ButtonLink>
          <p className={styles.note}>No credit card. Documents deletable at any time.</p>
        </div>
      </div>
    </section>
  );
}
