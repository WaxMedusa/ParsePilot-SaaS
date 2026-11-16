import Link from 'next/link';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { getUsageSnapshot, getDailyUsage } from '@/lib/billing/usage';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { UsageChart } from '@/components/dashboard/UsageChart';
import { ButtonLink } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const auth = await requireWorkspaceAuth();
  const [usage, daily] = await Promise.all([getUsageSnapshot(auth.workspace.id), getDailyUsage(auth.workspace.id, 14)]);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Billing period"
        title="Usage"
        description={`${usage.plan.name} plan · period ${formatDate(usage.usage.periodStart)} – ${formatDate(usage.usage.periodEnd)}. Page counts are recorded in a persistent ledger when a job succeeds.`}
        actions={
          <>
            <ButtonLink href="/dashboard/settings/billing" variant="secondary">
              Billing settings
            </ButtonLink>
            <ButtonLink href="/dashboard/exports">Create export</ButtonLink>
          </>
        }
      />

      <div className={styles.grid4}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>01 / Pages used</span>
          <span className={styles.statValue}>{usage.usage.pagesUsed}</span>
          <span className={styles.statMeta}>of {usage.plan.monthlyPageLimit} this period</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>02 / Remaining</span>
          <span className={styles.statValue}>{usage.usage.pagesRemaining}</span>
          <span className={styles.statMeta}>resets {formatDate(usage.usage.periodEnd)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>03 / Documents processed</span>
          <span className={styles.statValue}>{usage.usage.documentsProcessed}</span>
          <span className={styles.statMeta}>accepted jobs this period</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>04 / Export rows</span>
          <span className={styles.statValue}>{usage.usage.exportRows}</span>
          <span className={styles.statMeta}>audited, not page-billed</span>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.cardBody}>
          <UsageChart data={daily} limit={usage.plan.monthlyPageLimit} />
        </div>
        <div className={styles.cardFoot}>
          <span>
            Bar height shows pages recorded per UTC day. The dashed line is your monthly limit ({usage.plan.monthlyPageLimit}).
          </span>
          <span>{usage.usage.percentUsed}% used</span>
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Entitlements</span>
            <span className={styles.cardHint}>enforced server-side</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.kv}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Plan</span>
                <span className={styles.kvValue}>{usage.plan.name}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Monthly pages</span>
                <span className={styles.kvValue}>{usage.plan.monthlyPageLimit.toLocaleString('en-US')}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Max upload</span>
                <span className={styles.kvValue}>{usage.plan.maxUploadMb} MB</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Members</span>
                <span className={styles.kvValue}>{usage.plan.maxMembers}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Subscription</span>
                <span className={styles.kvValue}>{usage.subscription.status}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Renews / cancels</span>
                <span className={styles.kvValue}>
                  {usage.subscription.currentPeriodEnd ? formatDate(usage.subscription.currentPeriodEnd) : '—'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>How pages are counted</span>
            <span className={styles.cardHint}>billing policy</span>
          </div>
          <div className={styles.cardBody}>
            <ul className={styles.timeline}>
              <li className={styles.timelineItem}>
                <span className={`${styles.timelineDot} ${styles.timelineDotDone}`} />
                <div>
                  <p className={styles.timelineLabel}>Successful completion</p>
                  <p className={styles.timelineMeta}>One ledger entry per job, keyed by job id. Retries cannot duplicate the charge.</p>
                </div>
              </li>
              <li className={styles.timelineItem}>
                <span className={`${styles.timelineDot} ${styles.timelineDotActive}`} />
                <div>
                  <p className={styles.timelineLabel}>Manual reprocess</p>
                  <p className={styles.timelineMeta}>Creates a new job and may count again, because the document is processed again.</p>
                </div>
              </li>
              <li className={styles.timelineItem}>
                <span className={styles.timelineDot} />
                <div>
                  <p className={styles.timelineLabel}>Failures</p>
                  <p className={styles.timelineMeta}>Jobs that never produce an extraction are not charged.</p>
                </div>
              </li>
            </ul>
            <p className={styles.hint} style={{ marginTop: 10 }}>
              See <Link href="/pricing">pricing</Link> for plan changes and the documented billing policy.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
