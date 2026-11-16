import Link from 'next/link';
import styles from './Logo.module.css';

export function Logo({ href = '/', tone = 'default' }: { href?: string; tone?: 'default' | 'inverse' }) {
  return (
    <Link href={href} className={`${styles.logo} ${tone === 'inverse' ? styles.inverse : ''}`} aria-label="ParsePilot home">
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 4.25h8.15L19 10.1v9.65H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
          <path d="M13.15 4.25v5.85H19" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
          <path d="M8.2 13.2h7.6M8.2 16.2h5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
      </span>
      <span className={styles.word}>ParsePilot</span>
    </Link>
  );
}
