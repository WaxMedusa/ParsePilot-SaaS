import Link from 'next/link';
import type { PublicPlan } from '@/lib/billing/plans';
import { formatCurrencyCents } from '@/lib/format';
import styles from './PricingTeaser.module.css';

const ORDER = ['free', 'starter', 'growth'];

export function PricingTeaser({ plans }: { plans: PublicPlan[] }) {
  const visible = ORDER.map((code) => plans.find((plan) => plan.code === code)).filter((plan): plan is PublicPlan => Boolean(plan));

  return (
    <section className={styles.section} id="pricing">
      <div className="container">
        <header className={styles.header}>
          <p className="kicker">08 / Pricing</p>
          <div className={styles.headerGrid}>
            <h2 className={styles.heading}>
              Start small.
              <br />
              <em className="serif">Grow on pages, with your team.</em>
            </h2>
            <p className={styles.lede}>
              Every plan includes the review queue, versioned extractions and private storage. Page limits are enforced
              server-side and reset at the start of each billing period; team seats are enforced when invitations are
              sent or accepted.
            </p>
          </div>
        </header>

        <div className={styles.table}>
          <div className={styles.tableHead} aria-hidden="true">
            <span>Plan</span>
            <span>Monthly</span>
            <span>Pages</span>
            <span>Max file</span>
            <span>Members</span>
            <span />
          </div>

          {visible.map((plan) => {
            const featured = plan.code === 'starter';
            const price = plan.priceCents === 0 ? 'Free' : formatCurrencyCents(plan.priceCents, plan.currency);
            return (
              <article key={plan.code} className={`${styles.row} ${featured ? styles.featured : ''}`}>
                <div className={styles.identity}>
                  <div className={styles.nameRow}>
                    <h3 className={styles.planName}>{plan.name}</h3>
                    {featured ? <span className={styles.tag}>Most teams start here</span> : null}
                  </div>
                  <p className={styles.description}>{plan.description}</p>
                  <ul className={styles.features}>
                    {plan.features.slice(0, 4).map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className={styles.price}>
                  <strong>{price}</strong>
                  {plan.priceCents > 0 ? <span>/ month</span> : <span>no card required</span>}
                </div>

                <div className={`${styles.spec} ${styles.specPages}`}>
                  <span>Pages</span>
                  <strong>{plan.monthlyPageLimit.toLocaleString('en-US')}</strong>
                  <small>per month</small>
                </div>

                <div className={`${styles.spec} ${styles.specFile}`}>
                  <span>Max file</span>
                  <strong>{plan.maxUploadMb} MB</strong>
                  <small>per upload</small>
                </div>

                <div className={`${styles.spec} ${styles.specMembers}`}>
                  <span>Members</span>
                  <strong>{plan.maxMembers}</strong>
                  <small>per workspace</small>
                </div>

                <div className={styles.action}>
                  <Link
                    href={plan.priceCents === 0 || plan.stripeConfigured ? `/signup?plan=${plan.code}` : '/contact'}
                    className={styles.cta}
                  >
                    {plan.priceCents === 0
                      ? 'Start free'
                      : plan.stripeConfigured
                        ? `Choose ${plan.name}`
                        : `Ask about ${plan.name}`}{' '}
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.footerRow}>
          <p>Need a volume agreement or a signed DPA? Enterprise terms are available on request. Paid self-serve checkout opens when billing is configured.</p>
          <Link href="/pricing" className={styles.footerLink}>
            Compare all plans <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
