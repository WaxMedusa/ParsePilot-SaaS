import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { PublicPlan } from '@/lib/billing/plans';
import { formatCurrencyCents } from '@/lib/format';
import styles from './PricingTeaser.module.css';

const ORDER = ['free', 'starter', 'growth'];

export function PricingTeaser({ plans }: { plans: PublicPlan[] }) {
  const visible = ORDER.map((code) => plans.find((plan) => plan.code === code)).filter((plan): plan is PublicPlan => Boolean(plan));

  return (
    <section className={styles.section} id="pricing">
      <div className="container">
        <div className={styles.header}>
          <div>
            <p className="eyebrow">Pricing</p>
            <h2 className={styles.heading}>Start small. Grow on pages, not seats.</h2>
          </div>
          <p className={styles.lede}>
            Every plan includes the review queue, versioned extractions and private storage. Monthly page limits are
            enforced server-side and reset at the start of each billing period.
          </p>
        </div>

        <div className={styles.grid}>
          {visible.map((plan) => {
            const featured = plan.code === 'starter';
            const price = plan.priceCents === 0 ? 'Free' : formatCurrencyCents(plan.priceCents, plan.currency);
            return (
              <article key={plan.code} className={`${styles.card} ${featured ? styles.featured : ''}`}>
                <div className={styles.cardHead}>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  {featured ? <span className={styles.tag}>Most teams start here</span> : null}
                </div>
                <p className={styles.planDescription}>{plan.description}</p>
                <div className={styles.priceRow}>
                  <span className={styles.price}>{price}</span>
                  {plan.priceCents > 0 ? <span className={styles.period}>/ month</span> : null}
                </div>
                <dl className={styles.specs}>
                  <div>
                    <dt>Pages</dt>
                    <dd>{plan.monthlyPageLimit.toLocaleString('en-US')} / month</dd>
                  </div>
                  <div>
                    <dt>Max file</dt>
                    <dd>{plan.maxUploadMb} MB</dd>
                  </div>
                  <div>
                    <dt>Members</dt>
                    <dd>{plan.maxMembers}</dd>
                  </div>
                </dl>
                <ul className={styles.features}>
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature}>
                      <Check size={13} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={`/signup?plan=${plan.code}`} className={`${styles.cta} ${featured ? styles.ctaFeatured : ''}`}>
                  {plan.priceCents === 0 ? 'Start free' : `Choose ${plan.name}`}
                  <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>

        <div className={styles.footerRow}>
          <p>Need a volume agreement, custom retention or a signed DPA? Enterprise terms are available on request.</p>
          <Link href="/pricing" className={styles.footerLink}>
            Compare all plans <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
