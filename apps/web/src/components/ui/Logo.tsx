import Link from 'next/link';
import styles from './Logo.module.css';

/**
 * The brand lockup: the primary logo artwork served from `/mainlogo.png`.
 * The image is height-driven so it keeps its own proportions at every size,
 * and it carries the artwork's colours, so `tone` only affects the link colour
 * around it (the artwork itself does not recolour with the theme).
 */
export function Logo({ href = '/', tone = 'default' }: { href?: string; tone?: 'default' | 'inverse' }) {
  return (
    <Link href={href} className={`${styles.logo} ${tone === 'inverse' ? styles.inverse : ''}`} aria-label="ParsePilot home">
      <img src="/mainlogo.png" alt="ParsePilot" width={2064} height={396} className={styles.mark} />
    </Link>
  );
}
