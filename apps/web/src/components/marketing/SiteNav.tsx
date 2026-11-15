import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';
import styles from './SiteNav.module.css';

const LINKS = [
  { href: '/#product', label: 'Product' },
  { href: '/#pipeline', label: 'Pipeline' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/docs/api', label: 'API' },
];

export function SiteNav() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />
        <nav className={styles.links} aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link href="/login" className={styles.signIn}>
            Sign in
          </Link>
          <ButtonLink href="/signup" size="sm" iconAfter={<ArrowRight />}>
            Start free
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
