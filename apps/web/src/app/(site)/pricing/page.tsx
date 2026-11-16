import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicPlans } from '@/lib/billing/plans';
import { formatCurrencyCents } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';
import styles from './PricingPage.module.css';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'ParsePilot plans by monthly page volume, file size and export formats. Page limits enforced server-side.',
};

export const revalidate = 300;

const FAQ = [
  {
    question: 'How are pages counted?',
    answer:
      'A page is counted when a processing job completes successfully. A retry of the same job is never charged twice. Deliberately reprocessing a document creates a new job and may count again.',
  },
  {
    question: 'What happens if I hit my page limit?',
    answer:
      'Uploads are rejected before the file is stored, with the period end date in the error. Documents already processed remain accessible. You can upgrade or wait for the next period.',
  },
  {
    question: 'Can I change plan later?',
    answer:
      'Yes. Upgrades take effect immediately through Stripe checkout. Downgrades take effect at the end of the current billing period, and existing documents stay available.',
  },
  {
    question: 'What happens if a payment fails?',
    answer:
      'The subscription is marked past due and processing continues during a seven-day grace period while payment is retried. After that, processing is blocked until billing is resolved.',
  },
  {
    question: 'Do you offer a data processing agreement?',
    answer:
      'A DPA template is published and can be completed for business customers. It must be executed with the operator before it becomes binding.',
  },
  {
    question: 'Can I delete my data?',
    answer:
      'Yes. Documents can be deleted from the workspace immediately, and account deletion is available in Privacy & Data settings after re-authentication. Storage objects are purged by the retention worker.',
  },
];

const INCLUDED = [
  ['Private storage', 'Random object keys, short-lived signed downloads, deletion workflows.'],
  ['Review queue', 'Confidence scores, arithmetic checks and field-level corrections.'],
  ['Versioned extractions', 'Reprocessing keeps your manual edits and records a new version.'],
  ['Duplicate detection', 'Checksum matching plus field-similarity checks within your workspace.'],
  ['Audit trail', 'Uploads, edits, deletions, downloads and retries recorded with correlation IDs.'],
  ['Reliable jobs', 'Exponential backoff, heartbeats, dead-letter handling and manual replay.'],
];

export default async function PricingPage() {
  const plans = await listPublicPlans();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroMeta}>
            <p className="kicker">Pricing / plans</p>
            <span>Page volume, not seat count</span>
          </div>
          <div className={styles.heroGrid}>
            <h1 className={styles.title}>Priced on pages processed, not people invited.</h1>
            <div className={styles.heroCopy}>
              <p className={styles.lede}>
                Every plan includes the full extraction pipeline, validation, duplicate detection and the review queue.
                Limits are enforced in the backend — not hidden in the interface.
              </p>
              <Link href="/contact" className={styles.heroLink}>
                Ask about volume terms <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.plansSection}>
        <div className="container">
          <div className={styles.tableHead} aria-hidden="true">
            <span>Plan</span>
            <span>Monthly</span>
            <span>Pages</span>
            <span>Max file</span>
            <span>Members</span>
            <span />
          </div>

          <div className={styles.plans}>
            {plans.map((plan) => {
              const featured = plan.code === 'starter';
              const enterprise = plan.code === 'enterprise';
              const price = enterprise ? 'Custom' : plan.priceCents === 0 ? 'Free' : formatCurrencyCents(plan.priceCents, plan.currency);
              const href = enterprise ? '/contact' : `/signup?plan=${plan.code}`;
              return (
                <article key={plan.code} className={`${styles.plan} ${featured ? styles.planFeatured : ''}`}>
                  <div className={styles.planIdentity}>
                    <div className={styles.planNameRow}>
                      <h2 className={styles.planName}>{plan.name}</h2>
                      {featured ? <span className={styles.planTag}>Popular entry point</span> : null}
                    </div>
                    <p className={styles.planDescription}>{plan.description}</p>
                    <ul className={styles.planFeatures}>
                      {plan.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </div>

                  <div className={styles.price}>
                    <strong>{price}</strong>
                    {plan.priceCents > 0 && !enterprise ? <span>/ month</span> : null}
                    {enterprise ? <span>annual terms</span> : plan.priceCents === 0 ? <span>no card required</span> : null}
                  </div>

                  <div className={`${styles.spec} ${styles.specPages}`}>
                    <span>Monthly pages</span>
                    <strong>{plan.monthlyPageLimit.toLocaleString('en-US')}</strong>
                    <small>per month</small>
                  </div>

                  <div className={`${styles.spec} ${styles.specFile}`}>
                    <span>Max upload</span>
                    <strong>{plan.maxUploadMb} MB</strong>
                    <small>per file</small>
                  </div>

                  <div className={`${styles.spec} ${styles.specMembers}`}>
                    <span>Members</span>
                    <strong>{plan.maxMembers}</strong>
                    <small>{plan.maxWorkspaces} workspace limit</small>
                  </div>

                  <div className={styles.action}>
                    <ButtonLink
                      href={href}
                      variant={featured ? 'primary' : 'secondary'}
                      size="sm"
                      iconAfter={<span aria-hidden="true">↗</span>}
                    >
                      {enterprise ? 'Talk to us' : plan.priceCents === 0 ? 'Start free' : `Choose ${plan.name}`}
                    </ButtonLink>
                  </div>
                </article>
              );
            })}
          </div>

          <p className={styles.billingNote}>
            Prices are shown in USD and exclude applicable taxes. Payment processing is handled by Stripe when billing is
            configured on this deployment. Enterprise terms are available on request — see the{' '}
            <Link href="/contact">contact page</Link>.
          </p>
        </div>
      </section>

      <section className={styles.comparison}>
        <div className="container">
          <div className={styles.comparisonHead}>
            <p className="kicker">Included in every plan</p>
            <h2 className={styles.comparisonTitle}>The product does not change with the price.</h2>
          </div>
          <div className={styles.compareGrid}>
            {INCLUDED.map(([title, body], index) => (
              <div key={title} className={styles.compareItem}>
                <span className={styles.compareIndex}>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={`container ${styles.faqGrid}`}>
          <div className={styles.faqIntro}>
            <p className="kicker">Billing questions</p>
            <h2 className={styles.faqTitle}>The details that usually get asked.</h2>
            <p className={styles.faqLede}>
              The billing policy is documented and implemented, not improvised. If something is not covered here, ask us
              before you buy.
            </p>
            <ButtonLink href="/contact" variant="secondary" iconAfter={<span aria-hidden="true">↗</span>}>
              Ask a question
            </ButtonLink>
          </div>
          <dl className={styles.faqList}>
            {FAQ.map((item) => (
              <div key={item.question} className={styles.faqItem}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
