'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import styles from './SiteNav.module.css';

const LINKS = [
  { href: '/#product', label: 'Product' },
  { href: '/#pipeline', label: 'Pipeline' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/security', label: 'Security' },
  { href: '/docs/api', label: 'API' },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = (href: string) => !href.startsWith('/#') && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />

        <nav className={styles.links} aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.link} ${active(link.href) ? styles.linkActive : ''}`}
              aria-current={active(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/login" className={styles.signIn}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.start}>
            Start free <span aria-hidden="true">↗</span>
          </Link>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
          >
            <span>{open ? 'Close' : 'Menu'}</span>
            <span className={`${styles.menuGlyph} ${open ? styles.menuGlyphOpen : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {open ? (
        <div className={styles.mobile} id="site-menu">
          <nav className={styles.mobileLinks} aria-label="Mobile navigation">
            {LINKS.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.mobileLink} ${active(link.href) ? styles.mobileLinkActive : ''}`}
                onClick={() => setOpen(false)}
                aria-current={active(link.href) ? 'page' : undefined}
              >
                <span className={styles.mobileIndex}>{String(index + 1).padStart(2, '0')}</span>
                {link.label}
              </Link>
            ))}
          </nav>
          <div className={styles.mobileFoot}>
            <Link href="/login" className={styles.mobileSecondary} onClick={() => setOpen(false)}>
              Sign in to your workspace
            </Link>
            <Link href="/signup" className={styles.mobilePrimary} onClick={() => setOpen(false)}>
              Start free — 100 pages <span aria-hidden="true">↗</span>
            </Link>
            <p>Private storage · Native text extraction · Human review</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}
