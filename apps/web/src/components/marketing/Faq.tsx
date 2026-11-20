import Link from 'next/link';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';
import styles from './Faq.module.css';

type Question = {
  question: string;
  answer: ReactNode;
};

const QUESTIONS: Question[] = [
  {
    question: 'Which files can I upload?',
    answer: (
      <>
        PDFs, plus PNG, JPEG, TIFF and WebP images. The file signature is checked against the declared content type, so
        renaming a file does not slip it past validation. The Free plan accepts 4 MB per file; paid plans accept 10 MB.
      </>
    ),
  },
  {
    question: 'Does every document get sent to OCR?',
    answer: (
      <>
        No. The native text layer is read first, and only pages without a usable layer are rasterised for OCR, within a
        page budget. Text-based invoices therefore cost less and finish faster than scans, and the status timeline shows
        which path the document took.
      </>
    ),
  },
  {
    question: 'What happens when the extraction is wrong?',
    answer: (
      <>
        Low-confidence fields, missing totals, arithmetic conflicts and suspected duplicates move the document to needs
        review instead of being exported quietly. A correction is stored beside the original value with the reviewer and
        timestamp, kept across reprocessing, and the totals are re-checked after every edit.
      </>
    ),
  },
  {
    question: 'What can I export?',
    answer: (
      <>
        CSV on every plan, XLSX on paid plans. Exports are generated from reviewed values, and a live link rebuilds the
        sheet from current data on each load. Generated export files expire after seven days.
      </>
    ),
  },
  {
    question: 'Where are my documents kept, and for how long?',
    answer: (
      <>
        Files land in private object storage under random keys — no public buckets and no permanent links. Downloads use
        signed URLs that expire after 300 seconds and require workspace membership. Deleting a document revokes access
        immediately and purges the file and extraction rows after 30 days.
      </>
    ),
  },
  {
    question: 'Can I drive this from my own systems?',
    answer: (
      <>
        Yes. The versioned REST API lives at <code>/api/v1</code> with an OpenAPI 3.1 document at{' '}
        <code>/api/v1/openapi</code>. Clients authenticate with a bearer session token, send the workspace id on each
        request, and every response carries a request id for support.
      </>
    ),
  },
  {
    question: 'What happens after the 100 free pages?',
    answer: (
      <>
        Nothing breaks and no card is charged. Page and seat limits are enforced server-side and reset at the start of
        each billing period, so you can keep reviewing what you have uploaded and upgrade when the volume is real.
      </>
    ),
  },
];

const STEPS = [
  {
    index: '01',
    title: 'Create a workspace',
    body: 'Email and password. No card, no sales call, no trial timer.',
  },
  {
    index: '02',
    title: 'Upload a batch',
    body: 'Send a handful of real invoices — the ones that give your team trouble.',
  },
  {
    index: '03',
    title: 'Review, then export',
    body: 'Confirm the uncertain fields, check the arithmetic, and export reviewed values.',
  },
];

export function Faq() {
  return (
    <section className={styles.section} id="faq">
      <div className="container">
        <header className={styles.header}>
          <p className="kicker">09 / Questions</p>
          <div className={styles.headerGrid}>
            <Reveal as="h2" className={styles.heading}>
              Before you upload
              <br />
              anything, <em className="serif">the practical answers.</em>
            </Reveal>
            <Reveal className={styles.headerCopy} delay={80}>
              <p>
                Document tools invite reasonable suspicion. These are the answers a finance lead usually asks for on the
                first call — formats, OCR, corrections, storage, exports and limits.
              </p>
              <Link href="/security" className={styles.headerLink}>
                What is implemented, and what is not <span aria-hidden="true">↗</span>
              </Link>
            </Reveal>
          </div>
        </header>

        <div className={styles.grid}>
          <Reveal className={styles.aside} delay={60}>
            <p className={styles.asideLabel}>From upload to export</p>
            <ol className={styles.steps}>
              {STEPS.map((step) => (
                <li key={step.index} className={styles.step}>
                  <span className={styles.stepIndex}>{step.index}</span>
                  <div>
                    <p className={styles.stepTitle}>{step.title}</p>
                    <p className={styles.stepBody}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className={styles.asideFoot}>
              <ButtonLink href="/signup" variant="secondary" iconAfter={<span aria-hidden="true">↗</span>}>
                Create a workspace
              </ButtonLink>
              <Link href="/contact" className={styles.asideLink}>
                Ask us directly
              </Link>
            </div>
          </Reveal>

          <div className={styles.list}>
            {QUESTIONS.map((item, index) => (
              <details key={item.question} className={styles.item} open={index === 0}>
                <summary className={styles.summary}>
                  <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.question}>{item.question}</span>
                  <span className={styles.glyph} aria-hidden="true" />
                </summary>
                <div className={styles.answer}>
                  <p>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
