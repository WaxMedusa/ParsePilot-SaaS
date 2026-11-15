import { requireWorkspaceAuth } from '@/lib/auth/server';
import { getUsageSnapshot } from '@/lib/billing/usage';
import { listPublicPlans } from '@/lib/billing/plans';
import { appConfig } from '@/lib/env';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { BillingPanel } from '@/components/dashboard/BillingPanel';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function BillingSettingsPage({ searchParams }: { searchParams: Promise<{ plan?: string; checkout?: string }> }) {
  const auth = await requireWorkspaceAuth();
  const params = await searchParams;
  const [usage, plans] = await Promise.all([getUsageSnapshot(auth.workspace.id), listPublicPlans()]);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Settings"
        title="Billing"
        description="Plan entitlements come from the database. Checkout and payment management are handled by Stripe when billing is configured."
      />
      {params.checkout === 'success' ? (
        <div className={`${styles.notice} ${styles.noticeInfo}`} role="status">
          Checkout returned successfully. Subscription state is updated by the verified Stripe webhook, which may take a
          few seconds to reflect here.
        </div>
      ) : null}
      {params.checkout === 'cancelled' ? (
        <div className={`${styles.notice} ${styles.noticeWarning}`} role="status">
          Checkout was cancelled. Your existing plan remains active.
        </div>
      ) : null}
      <BillingPanel
        plans={plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          description: plan.description,
          priceCents: plan.priceCents,
          currency: plan.currency,
          monthlyPageLimit: plan.monthlyPageLimit,
          maxUploadMb: plan.maxUploadMb,
          maxMembers: plan.maxMembers,
          features: plan.features,
          stripeConfigured: plan.stripeConfigured,
        }))}
        currentPlan={usage.plan.code}
        subscription={{
          status: usage.subscription.status,
          currentPeriodEnd: usage.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: usage.subscription.cancelAtPeriodEnd,
          stripeCustomerId: usage.subscription.stripeCustomerId,
        }}
        usage={{
          pagesUsed: usage.usage.pagesUsed,
          pageLimit: usage.plan.monthlyPageLimit,
          pagesRemaining: usage.usage.pagesRemaining,
          percentUsed: usage.usage.percentUsed,
          periodEnd: usage.usage.periodEnd,
        }}
        billingConfigured={Boolean(appConfig.stripe.secretKey)}
        role={auth.workspace.role}
        initialPlan={params.plan}
      />
    </div>
  );
}
