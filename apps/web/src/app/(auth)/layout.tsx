import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.aside}>
        <Logo tone="inverse" />
        <div className={styles.asideBody}>
          <p className={styles.asideEyebrow}>Document intelligence</p>
          <h2 className={styles.asideTitle}>
            Documents in.
            <br />
            Structured data out.
          </h2>
          <p className={styles.asideCopy}>
            ParsePilot runs extraction in the background, validates what it finds, and keeps a reviewable version history
            of every correction.
          </p>
          <ul className={styles.asideList}>
            <li>Native PDF text first, OCR only when needed</li>
            <li>Private storage with short-lived signed links</li>
            <li>CSV and XLSX exports from reviewed data</li>
          </ul>
        </div>
        <div className={styles.asideFoot}>
          <p>Files are processed asynchronously. Nothing is executed from document content.</p>
          <div className={styles.asideLinks}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/security">Security</Link>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <div className={styles.mobileBrand}>
          <Logo />
        </div>
        <div className={styles.formWrap}>{children}</div>
        <div className={styles.mainFoot}>
          <Link href="/">← Back to the public site</Link>
          <span>Need help? See the contact page.</span>
        </div>
      </div>
    </div>
  );
}
