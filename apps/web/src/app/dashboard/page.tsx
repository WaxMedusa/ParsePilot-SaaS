import Link from 'next/link';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { listDocuments, countDocumentsByStatus } from '@/lib/documents/repository';
import { listJobs, jobSummary } from '@/lib/jobs/service';
import { getUsageSnapshot } from '@/lib/billing/usage';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { UploadPanel } from '@/components/dashboard/UploadPanel';
import { DocumentsTable } from '@/components/dashboard/DocumentsTable';
import { JobsTable } from '@/components/dashboard/JobsTable';
import { ButtonLink } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function DashboardOverviewPage() {
  const auth = await requireWorkspaceAuth();
  const workspaceId = auth.workspace.id;

  const [usage, counts, recentDocuments, recentJobs] = await Promise.all([
    getUsageSnapshot(workspaceId),
    countDocumentsByStatus(workspaceId),
    listDocuments({
      workspaceId,
      skip: 0,
      take: 6,
      sortField: 'createdAt',
      sortDirection: 'desc',
    }),
    listJobs({ workspaceId, skip: 0, take: 5, sortField: 'createdAt', sortDirection: 'desc' }),
  ]);

  const totalDocuments = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const needsReview = counts.needs_review ?? 0;
  const failed = counts.failed ?? 0;
  const active = (counts.queued ?? 0) + (counts.extracting_text ?? 0) + (counts.running_ocr ?? 0) + (counts.extracting_fields ?? 0) + (counts.validating ?? 0) + (counts.detecting_duplicates ?? 0);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={auth.workspace.name}
        title="Overview"
        description="Processing health, review workload and usage."
        actions={
          <>
            <ButtonLink href="/dashboard/review" variant="secondary">
              Review queue{needsReview > 0 ? ` · ${needsReview}` : ''}
            </ButtonLink>
            <ButtonLink href="#upload" variant="secondary">
              Upload
            </ButtonLink>
            <ButtonLink href="/dashboard/documents" iconAfter={<span aria-hidden="true">↗</span>}>
              All documents
            </ButtonLink>
          </>
        }
      />

      <div className={styles.grid4}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>01 / Documents</span>
          <span className={styles.statValue}>{totalDocuments}</span>
          <span className={styles.statMeta}>{active} processing now</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>02 / Needs review</span>
          <span className={styles.statValue}>{needsReview}</span>
          <span className={styles.statMeta}>
            <Link href="/dashboard/review">{needsReview > 0 ? 'Open review queue' : 'Review queue is clear'}</Link>
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>03 / Pages used</span>
          <span className={styles.statValue}>
            {usage.usage.pagesUsed}
            <span className={styles.statValueSub}> / {usage.plan.monthlyPageLimit}</span>
          </span>
          <span className={styles.statMeta}>Resets {formatDate(usage.usage.periodEnd)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>04 / Failed jobs</span>
          <span className={styles.statValue}>{failed}</span>
          <span className={styles.statMeta}>{failed > 0 ? 'Retry from the job list' : 'No failures'}</span>
        </div>
      </div>

      <div className={styles.split}>
        <div className={styles.stack}>
          <section className={styles.card} id="upload">
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Upload documents</span>
              <span className={styles.cardHint}>{usage.plan.maxUploadMb} MB max</span>
            </div>
            <div className={styles.cardBody}>
              <UploadPanel workspaceId={workspaceId} compact maxUploadMb={usage.plan.maxUploadMb} />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Recent documents</span>
              <Link href="/dashboard/documents" className={styles.cardHint}>
                View all →
              </Link>
            </div>
            <DocumentsTable documents={recentDocuments.documents} workspaceId={workspaceId} />
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Recent jobs</span>
              <Link href="/dashboard/jobs" className={styles.cardHint}>
                Job history →
              </Link>
            </div>
            <div className={styles.cardBodyFlush}>
              <JobsTable jobs={recentJobs.jobs.map(jobSummary)} workspaceId={workspaceId} />
            </div>
          </section>
        </div>

        <div className={styles.stack}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>This period</span>
              <span className={styles.cardHint}>{usage.plan.name}</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.kv}>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Pages used</span>
                  <span className={styles.kvValue}>{usage.usage.pagesUsed}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Remaining</span>
                  <span className={styles.kvValue}>{usage.usage.pagesRemaining}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Documents</span>
                  <span className={styles.kvValue}>{usage.usage.documentsProcessed}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Upload limit</span>
                  <span className={styles.kvValue}>{usage.plan.maxUploadMb} MB</span>
                </div>
              </div>
              <div className={styles.progress} style={{ marginTop: 12 }}>
                <div className={styles.progressBar} style={{ width: `${Math.min(100, usage.usage.percentUsed)}%` }} />
              </div>
              <div className={styles.actions} style={{ marginTop: 14 }}>
                <ButtonLink href="/dashboard/usage" variant="secondary" size="sm">
                  Usage detail
                </ButtonLink>
                <ButtonLink href="/dashboard/settings/billing" variant="ghost" size="sm">
                  Billing
                </ButtonLink>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Pipeline stages</span>
              <span className={styles.cardHint}>now</span>
            </div>
            <div className={styles.cardBody}>
              <ul className={styles.timeline}>
                {[
                  { stage: 'queued', label: 'Queued', count: counts.queued ?? 0 },
                  { stage: 'extracting_text', label: 'Extracting text', count: counts.extracting_text ?? 0 },
                  { stage: 'running_ocr', label: 'Running OCR', count: counts.running_ocr ?? 0 },
                  { stage: 'extracting_fields', label: 'Extracting fields', count: counts.extracting_fields ?? 0 },
                  { stage: 'validating', label: 'Validating', count: counts.validating ?? 0 },
                  { stage: 'detecting_duplicates', label: 'Detecting duplicates', count: counts.detecting_duplicates ?? 0 },
                ].map((stage) => (
                  <li key={stage.stage} className={styles.timelineItem}>
                    <span className={`${styles.timelineDot} ${stage.count > 0 ? styles.timelineDotActive : ''}`} />
                    <p className={styles.timelineLabel}>
                      {stage.label}
                      <span className={styles.timelineCount}>{stage.count}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.cardFoot}>
              <span>{usage.subscription.status} subscription</span>
              <Link href="/security" className={styles.cardHint}>
                Security controls →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
