import Link from 'next/link';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { listJobs, jobSummary } from '@/lib/jobs/service';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { JobsTable } from '@/components/dashboard/JobsTable';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'dead_letter', label: 'Dead letter' },
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const auth = await requireWorkspaceAuth();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 25;
  const status = params.status && STATUSES.some((entry) => entry.value === params.status) ? params.status : undefined;

  const { jobs, total } = await listJobs({
    workspaceId: auth.workspace.id,
    skip: (page - 1) * pageSize,
    take: pageSize,
    status,
    sortField: 'createdAt',
    sortDirection: 'desc',
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const queryFor = (nextPage: number) => {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (nextPage > 1) query.set('page', String(nextPage));
    const qs = query.toString();
    return `/dashboard/jobs${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Operations"
        title="Processing jobs"
        description="Every job is a durable database row with attempts, a stage, a heartbeat and a failure category. Retries use exponential backoff; exhausted jobs are dead-lettered and can be replayed."
      />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.filters}>
            {STATUSES.map((entry) => {
              const query = new URLSearchParams();
              if (entry.value) query.set('status', entry.value);
              const qs = query.toString();
              return (
                <Link
                  key={entry.value || 'all'}
                  href={`/dashboard/jobs${qs ? `?${qs}` : ''}`}
                  className={`${styles.chip} ${(status ?? '') === entry.value ? styles.chipActive : ''}`}
                >
                  {entry.label}
                </Link>
              );
            })}
          </div>
          <span className={styles.cardHint}>{total} total</span>
        </div>
        <div className={styles.cardBodyFlush}>
          <JobsTable jobs={jobs.map(jobSummary)} workspaceId={auth.workspace.id} />
        </div>
        <div className={styles.cardFoot}>
          <span>
            Page {page} of {totalPages}
          </span>
          <div className={styles.actions}>
            {page > 1 ? (
              <Link href={queryFor(page - 1)} className={styles.chip}>
                ← Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={queryFor(page + 1)} className={styles.chip}>
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
