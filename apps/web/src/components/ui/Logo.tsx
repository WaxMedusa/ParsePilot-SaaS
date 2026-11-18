import Link from 'next/link';
import styles from './Logo.module.css';

/**
 * The brand lockup: a flat mark (bar, accent triangle, rounded sweep) beside a
 * two-tone wordmark. The mark is drawn to the artwork's own proportions
 * (246 x 198) and inherits the ink colour, so it flips with the theme while the
 * triangle stays burnt orange.
 */
export function Logo({ href = '/', tone = 'default' }: { href?: string; tone?: 'default' | 'inverse' }) {
  return (
    <Link href={href} className={`${styles.logo} ${tone === 'inverse' ? styles.inverse : ''}`} aria-label="ParsePilot home">
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 246 198" fill="none" focusable="false" aria-hidden="true">
          <path d="M0 0h158v53H0z" fill="currentColor" />
          <path d="M173 0l73 53h-73z" fill="var(--color-accent)" />
          <path d="M69 73h149.5a27.5 27.5 0 0 1 0 55H150L0 198z" fill="currentColor" />
        </svg>
      </span>
      <span className={styles.word}>
        Parse<span className={styles.wordAccent}>Pilot</span>
      </span>
    </Link>
  );
}
