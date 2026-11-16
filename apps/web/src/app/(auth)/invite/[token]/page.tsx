import type { Metadata } from 'next';
import Link from 'next/link';
import { getInvitationPreview } from '@/lib/workspaces/team';
import { getServerAuth } from '@/lib/auth/server';
import { InviteAcceptForm } from '@/components/auth/InviteAcceptForm';
import styles from '../../auth-page.module.css';

export const metadata: Metadata = { title: 'Workspace invitation' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getInvitationPreview(token);
  const auth = await getServerAuth();

  if (!preview) {
    return (
      <div>
        <p className={styles.eyebrow}>Workspace invitation</p>
        <h1 className={styles.title}>This invitation has expired</h1>
        <p className={styles.lede}>Ask a workspace owner to send a fresh invitation. Invitations expire automatically.</p>
        <div className={styles.notice}>
          <Link href="/login">Return to sign in</Link>
        </div>
      </div>
    );
  }

  const next = `/invite/${encodeURIComponent(token)}`;
  const emailMatches = auth?.user.email.toLowerCase() === preview.email.toLowerCase();

  return (
    <div>
      <p className={styles.eyebrow}>Workspace invitation</p>
      <h1 className={styles.title}>Join {preview.workspaceName}</h1>
      <p className={styles.lede}>
        {preview.invitedBy.name ?? preview.invitedBy.email} invited <strong>{preview.email}</strong> to join as a{' '}
        <strong>{preview.role}</strong>.
      </p>

      {auth ? (
        emailMatches ? (
          <InviteAcceptForm token={token} workspaceName={preview.workspaceName} />
        ) : (
          <div className={styles.notice}>
            You are signed in as <strong>{auth.user.email}</strong>, but this invitation was sent to{' '}
            <strong>{preview.email}</strong>. Sign out from the dashboard and sign in with the invited address to
            accept it.
          </div>
        )
      ) : (
        <div className={styles.form}>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className={styles.submit}>
            Sign in to accept
          </Link>
          <p className={styles.footnote}>
            New to ParsePilot?{' '}
            <Link href={`/signup?next=${encodeURIComponent(next)}`} className={styles.inlineLink}>
              Create an account with {preview.email}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
