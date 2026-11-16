import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/server';
import { Logo } from '@/components/ui/Logo';
import styles from './NoWorkspace.module.css';

export const dynamic = 'force-dynamic';

export default async function NoWorkspacePage() {
  const auth = await requireServerAuth();
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <Logo />
        <p className={styles.eyebrow}>Workspace access</p>
        <h1 className={styles.title}>No workspace available</h1>
        <p className={styles.body}>
          Your account ({auth.user.email}) is not a member of any workspace, or the workspace has been scheduled for
          deletion. Contact the workspace owner, or sign out and create a new account.
        </p>
        <div className={styles.actions}>
          <Link href="/contact" className={styles.primary}>
            Contact support <span aria-hidden="true">↗</span>
          </Link>
          <form action="/api/v1/auth/logout" method="post">
            <button type="submit" className={styles.secondary}>
              Sign out
            </button>
          </form>
        </div>
        <p className={styles.foot}>Private workspace access · ParsePilot</p>
      </div>
    </div>
  );
}
