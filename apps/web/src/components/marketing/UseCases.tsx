import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import styles from './UseCases.module.css';

const CASES = [
  {
    index: '01',
    meta: 'Accounts payable',
    title: 'Review the exceptions, not every invoice.',
    body: 'Invoices arrive from everywhere. ParsePilot extracts the line detail, checks the arithmetic and sends only the uncertain values to a human queue. Reviewed data is ready to export.',
  },
  {
    index: '02',
    meta: 'Shared services',
    title: 'One operating model across entities.',
    body: 'Give teams their own workspace while keeping the same extraction schema, review pattern and retention policy. Roles and workspace membership are enforced server-side.',
  },
  {
    index: '03',
    meta: 'Bookkeeping',
    title: 'Make month-end explainable.',
    body: 'Correct a field once, keep the original value beside it, and preserve the edit history. When a client asks why a number changed, the answer is already recorded.',
  },
  {
    index: '04',
    meta: 'Operations',
    title: 'A single route for every document.',
    body: 'Receipts, purchase orders and delivery notes all move through the same durable pipeline. You do not need a second tool for the documents that do not fit the main flow.',
  },
];

export function UseCases() {
  return (
    <section className={styles.section}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.header}>
          <p className="kicker">06 / Where it fits</p>
          <Reveal as="h2" className={styles.heading}>
            One extraction layer.
            <br />
            <em className="serif">Several ways to use it.</em>
          </Reveal>
        </div>

        <div className={styles.grid}>
          <Reveal className={styles.intro} delay={60}>
            <p>
              ParsePilot is built for teams that already have a process — and need the document work to be more
              reliable, not more theatrical.
            </p>
            <Link href="/#product" className={styles.link}>
              Explore the operating layer <span aria-hidden="true">↗</span>
            </Link>
          </Reveal>

          <div className={styles.cases}>
            {CASES.map((item, index) => (
              <Reveal as="article" key={item.index} className={styles.case} delay={index * 60}>
                <span className={styles.caseIndex}>{item.index}</span>
                <div className={styles.caseMain}>
                  <span className={styles.caseMeta}>{item.meta}</span>
                  <h3 className={styles.caseTitle}>{item.title}</h3>
                  <p className={styles.caseBody}>{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className={styles.quote} delay={80}>
          <p>“Every document gets the same question: can we defend this number?”</p>
          <span>ParsePilot / operating principle</span>
        </Reveal>
      </div>
    </section>
  );
}
