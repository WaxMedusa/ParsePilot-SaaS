import Link from 'next/link';
import styles from './Logo.module.css';

export function Logo({ href = '/', tone = 'default' }: { href?: string; tone?: 'default' | 'inverse' }) {
  return (
    <Link href={href} className={`${styles.logo} ${tone === 'inverse' ? styles.inverse : ''}`} aria-label="ParsePilot home">
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 3.75h7.2L18 8.55V20.25H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M13 3.9v4.9h4.8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 12.2h6M9 15.4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      <span className={styles.word}>ParsePilot</span>
    </Link>
  );
}
