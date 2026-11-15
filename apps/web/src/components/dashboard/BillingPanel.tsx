'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CreditCard, ExternalLink } from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiRequest, errorMessage } from '@/lib/client/api';
import { formatCurrencyCents, formatDate } from '@/lib/format';
import styles from './Dashboard.module.css';
import panel from './BillingPanel.module.css';

export type BillingPlan = {
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  monthlyPageLimit: number;
  maxUploadMb: number;
  maxMembers: number;
  features: string[];
  stripeConfigured: boolean;
};

type Props = {
  plans: BillingPlan[];
  currentPlan: string;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
  };
  usage: { pagesUsed: number; pageLimit: number; pagesRemaining: number; percentUsed: number; periodEnd: string };
  billingConfigured: boolean;
  role: string;
  initialPlan?: string;
};

export function BillingPanel({ plans, currentPlan, subscription, usage, billingConfigured, role, initialPlan }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | undefined>(initialPlan);

  const isOwner = role === 'owner';

  const checkout = async (planCode: string) => {
    setBusy(planCode);
    setError(null);
    setSelected(planCode);
    try {
      const result = await apiRequest<{ url: string }>('/api/v1/subscription/checkout', { method: 'POST', body: { planCode } });
      window.location.assign(result.url);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy('portal');
    setError(null);
    try {
      const result = await apiRequest<{ url: string }>('/api/v1/subscription/portal', { method: 'POST' });
      window.location.assign(result.url);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(null);
    }
  };

  return (
    <div className={styles.page}>
      {error ? <div className={`${styles.notice} ${styles.noticeDanger}`} role="alert">{error}</div> : null}
      {!billingConfigured ? (
        <div className={`${styles.notice} ${styles.noticeWarning}`} role="note">
          Billing is not configured on this deployment. Add Stripe credentials and price IDs in the environment to enable
          checkout and the billing portal. Plan entitlements shown here come from the database and are enforced
          regardless.
        </div>
      ) : null}

      <div className={styles.split}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Current plan</span>
            <StatusBadge status={subscription.status} />
          </div>
          <div className={styles.cardBody}>
            <div className={panel.currentPlan}>
              <span className={panel.currentName}>{plans.find((plan) => plan.code === currentPlan)?.name ?? currentPlan}</span>
              <span className={panel.currentMeta}>
                {subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'}{' '}
                {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'per usage period'}
              </span>
            </div>
            <div className={styles.kv} style={{ marginTop: 12 }}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Pages used this period</span>
                <span className={styles.kvValue}>
                  {usage.pagesUsed} / {usage.pageLimit}
                </span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Pages remaining</span>
                <span className={styles.kvValue}>{usage.pagesRemaining}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Period ends</span>
                <span className={`${styles.kvValue} ${styles.kvMono}`}>{formatDate(usage.periodEnd)}</span>
              </div>
            </div>
            <div className={styles.progress} style={{ marginTop: 12 }}>
              <div className={styles.progressBar} style={{ width: `${Math.min(100, usage.percentUsed)}%` }} />
            </div>
            <div className={styles.actions} style={{ marginTop: 14 }}>
              {subscription.stripeCustomerId ? (
                <Button variant="secondary" size="sm" icon={<ExternalLink />} onClick={portal} disabled={busy !== null || !isOwner}>
                  {busy === 'portal' ? 'Opening…' : 'Manage billing'}
                </Button>
              ) : null}
              {!isOwner ? <span className={styles.hint}>Only the workspace owner can change billing.</span> : null}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Billing policy</span>
            <span className={styles.cardHint}>documented</span>
          </div>
          <div className={styles.cardBody}>
            <ul className={panel.policy}>
              <li>Pages are counted when a processing job completes successfully.</li>
              <li>Retrying the same job never charges the page count twice.</li>
              <li>Deliberate reprocessing creates a new job and may count again.</li>
              <li>Failed jobs that never produce an extraction are not charged.</li>
              <li>Uploads are rejected before storage when the plan limit would be exceeded.</li>
              <li>Failed payments enter a seven-day grace period before processing is blocked.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.grid3}>
        {plans.map((plan) => {
          const active = plan.code === currentPlan;
          const highlighted = active || plan.code === selected;
          const price = plan.priceCents === 0 ? 'Free' : formatCurrencyCents(plan.priceCents, plan.currency);
          return (
            <article key={plan.code} className={`${panel.planCard} ${highlighted ? panel.planActive : ''}`}>
              <div className={panel.planHead}>
                <h3 className={panel.planName}>{plan.name}</h3>
                {active ? <Badge tone="success">Current</Badge> : null}
              </div>
              <p className={panel.planDescription}>{plan.description}</p>
              <p className={panel.planPrice}>
                {price}
                {plan.priceCents > 0 ? <span className={panel.planPeriod}> / month</span> : null}
              </p>
              <div className={panel.planSpecs}>
                <span>{plan.monthlyPageLimit.toLocaleString('en-US')} pages</span>
                <span>{plan.maxUploadMb} MB files</span>
                <span>{plan.maxMembers} members</span>
              </div>
              <ul className={panel.planFeatures}>
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {active ? (
                <Button variant="secondary" size="sm" block disabled>
                  Current plan
                </Button>
              ) : plan.priceCents === 0 ? (
                <Button variant="secondary" size="sm" block disabled={!isOwner} onClick={portal} title="Downgrade through the billing portal">
                  <CreditCard /> Downgrade in portal
                </Button>
              ) : (
                <Button
                  variant={highlighted ? 'primary' : 'secondary'}
                  size="sm"
                  block
                  disabled={!isOwner || busy !== null || !billingConfigured}
                  onClick={() => checkout(plan.code)}
                  iconAfter={<ArrowUpRight />}
                >
                  {busy === plan.code ? 'Opening checkout…' : `Choose ${plan.name}`}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <p className={styles.hint}>
        Changing plan uses Stripe Checkout. Downgrades and cancellation are handled in the billing portal. On cancellation,
        paid features remain until the end of the current billing period.
      </p>
    </div>
  );
}
