import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { CookieSettingsButton } from '@/components/cookies/CookieSettingsButton';
import styles from './SiteFooter.module.css';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#product', label: 'Overview' },
      { href: '/#pipeline', label: 'Processing pipeline' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/#faq', label: 'Questions' },
      { href: '/docs/api', label: 'API reference' },
    ],
  },
  {
    title: 'Trust & legal',
    links: [
      { href: '/security', label: 'Security' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/data-processing', label: 'Data Processing Agreement' },
    ],
  },
  {
    title: 'Compliance',
    links: [
      { href: '/cookies', label: 'Cookie Policy' },
      { href: '/acceptable-use', label: 'Acceptable Use' },
      { href: '/subprocessors', label: 'Subprocessors' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.topline}>
          <Logo />
          <p className={styles.edition}>Document intelligence / 2026</p>
        </div>

        <p className={styles.wordmark} aria-hidden="true">
          Parse<span>Pilot</span>.
        </p>

        <div className={styles.grid}>
          <div className={styles.brand}>
            <p className={styles.brandCopy}>
              Document data extraction for finance and operations teams. Files are processed asynchronously, stored
              privately, and every extracted value can be reviewed before it reaches your ledger.
            </p>
            <div className={styles.status}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span>Deployment health at /ready</span>
            </div>
          </div>

          <div className={styles.columns}>
            {COLUMNS.map((column) => (
              <div key={column.title} className={styles.column}>
                <h2 className={styles.columnTitle}>{column.title}</h2>
                <ul className={styles.list}>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={styles.link}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.legalNote}>
            © {new Date().getFullYear()} ParsePilot. Legal entity, registered address and governing jurisdiction are
            pending finalisation — see the legal pages for outstanding placeholders.
          </p>
          <div className={styles.bottomLinks}>
            <CookieSettingsButton />
            <Link href="/contact" className={styles.link}>
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
