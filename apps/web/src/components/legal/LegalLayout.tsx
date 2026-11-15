import Link from 'next/link';
import { CheckCircle2, Download, FileWarning, Mail, Printer } from 'lucide-react';
import type { LegalDocument } from '@/content/legal/types';
import { legalConfig, hasUnresolvedLegalPlaceholders, listOutstandingPlaceholders } from '@/config/legal';
import { LEGAL_PAGES } from '@/content/legal';
import { CookieSettingsButton } from '@/components/cookies/CookieSettingsButton';
import styles from './LegalLayout.module.css';

function PlaceholderText({ text }: { text: string }) {
  const parts = text.split(/(\[\[REQUIRED:[^\]]+\]\])/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('[[REQUIRED:') ? (
          <mark key={index} className={styles.placeholder} title="Operator must supply this value before launch">
            {part.replace(/^\[\[REQUIRED:\s*/, '').replace(/\]\]$/, '')}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export function LegalLayout({ document }: { document: LegalDocument }) {
  const outstanding = listOutstandingPlaceholders();
  const showDraft = hasUnresolvedLegalPlaceholders();

  return (
    <div className={styles.page}>
      <div className={`container ${styles.shell}`}>
        <aside className={styles.sidebar}>
          <nav className={styles.nav} aria-label="Legal documents">
            <p className={styles.navTitle}>Legal & trust</p>
            <ul className={styles.navList}>
              {LEGAL_PAGES.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/${page.slug}`}
                    className={`${styles.navLink} ${page.slug === document.slug ? styles.navActive : ''}`}
                    aria-current={page.slug === document.slug ? 'page' : undefined}
                  >
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.toc} aria-label="On this page">
            <p className={styles.navTitle}>On this page</p>
            <ol className={styles.tocList}>
              {document.sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className={styles.tocLink}>
                    <span className={styles.tocNumber}>{String(index + 1).padStart(2, '0')}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.helpCard}>
            <Mail size={15} aria-hidden="true" />
            <p>Questions about this document?</p>
            <Link href="/contact" className={styles.helpLink}>
              Contact the team
            </Link>
          </div>
        </aside>

        <main className={styles.main}>
          <header className={styles.header}>
            <p className={styles.breadcrumb}>
              <Link href="/">Home</Link> <span aria-hidden="true">/</span> Legal
            </p>
            <h1 className={styles.title}>{document.title}</h1>
            <p className={styles.subtitle}>{document.subtitle}</p>
            <dl className={styles.meta}>
              <div>
                <dt>Version</dt>
                <dd className="mono">{document.version}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd className="mono">{document.lastUpdated}</dd>
              </div>
              <div>
                <dt>Effective date</dt>
                <dd>
                  <PlaceholderText text={document.effectiveDate} />
                </dd>
              </div>
            </dl>
            <div className={styles.actions}>
              <a href={`/${document.slug}`} className={styles.printButton} onClick={undefined}>
                <Printer size={13} /> Print / save as PDF
              </a>
              <CookieSettingsButton variant="link" />
            </div>
          </header>

          {showDraft ? (
            <div className={styles.draft} role="note">
              <FileWarning size={16} aria-hidden="true" />
              <div>
                <strong>Draft pending legal review.</strong>
                <p>
                  Business identity, contact details and effective dates are not finalised. {outstanding.length}{' '}
                  placeholder{outstanding.length === 1 ? '' : 's'} must be completed before this document can be used
                  commercially. Highlighted items show where information is required; none of them have been invented.
                </p>
                <Link href="/contact" className={styles.draftLink}>
                  How to complete these details
                </Link>
              </div>
            </div>
          ) : (
            <div className={styles.reviewed} role="note">
              <CheckCircle2 size={16} aria-hidden="true" />
              <p>
                This document was reviewed on {legalConfig.securityReviewDate}. Version {document.version}.
              </p>
            </div>
          )}

          <div className={styles.summary}>
            {document.summary.map((paragraph) => (
              <p key={paragraph}>
                <PlaceholderText text={paragraph} />
              </p>
            ))}
          </div>

          <div className={styles.sections}>
            {document.sections.map((section, sectionIndex) => (
              <section key={section.id} id={section.id} className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionNumber}>{String(sectionIndex + 1).padStart(2, '0')}</span>
                  <h2 className={styles.sectionTitle}>
                    {section.title}
                    <a href={`#${section.id}`} className={styles.anchor} aria-label={`Link to section ${section.title}`}>
                      #
                    </a>
                  </h2>
                </div>
                <div className={styles.clauses}>
                  {section.clauses.map((clause, clauseIndex) => {
                    const number = `${sectionIndex + 1}.${clauseIndex + 1}`;
                    if (typeof clause === 'string') {
                      return (
                        <p key={number} className={styles.clause}>
                          <span className={styles.clauseNumber}>{number}</span>
                          <span>
                            <PlaceholderText text={clause} />
                          </span>
                        </p>
                      );
                    }
                    return (
                      <div key={number} className={styles.clauseGroup}>
                        <p className={styles.clause}>
                          <span className={styles.clauseNumber}>{number}</span>
                          <span>
                            <strong className={styles.lead}>
                              <PlaceholderText text={clause.lead} />
                            </strong>{' '}
                            <PlaceholderText text={clause.text} />
                          </span>
                        </p>
                        {clause.items ? (
                          <ul className={styles.clauseList}>
                            {clause.items.map((item) => (
                              <li key={item}>
                                <PlaceholderText text={item} />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                  {section.list ? (
                    <ul className={styles.bulletList}>
                      {section.list.map((item) => (
                        <li key={item}>
                          <PlaceholderText text={item} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.table ? (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            {section.table.columns.map((column) => (
                              <th key={column} scope="col">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex}>
                                  <PlaceholderText text={cell} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {section.table.caption ? <p className={styles.caption}>{section.table.caption}</p> : null}
                    </div>
                  ) : null}
                  {section.note ? (
                    <p className={styles.sectionNote}>
                      <PlaceholderText text={section.note} />
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <section className={styles.history} aria-labelledby="version-history">
            <h2 id="version-history" className={styles.historyTitle}>
              Version history
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Date</th>
                    <th scope="col">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {document.versionHistory.map((entry) => (
                    <tr key={`${entry.version}-${entry.date}`}>
                      <td className="mono">{entry.version}</td>
                      <td className="mono">{entry.date}</td>
                      <td>{entry.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.footer}>
            <div>
              <p className={styles.footerTitle}>Document owner</p>
              <p className={styles.footerText}>
                {legalConfig.productName} — {legalConfig.legalEntityName}
              </p>
              <p className={styles.footerText}>
                Privacy: {legalConfig.privacyEmail} · Security: {legalConfig.securityEmail}
              </p>
            </div>
            <div className={styles.related}>
              {document.related?.map((link) => (
                <Link key={link.href} href={link.href} className={styles.relatedLink}>
                  {link.label}
                </Link>
              ))}
              <a className={styles.relatedLink} href={`/${document.slug}`} download>
                <Download size={12} /> Download this page
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
