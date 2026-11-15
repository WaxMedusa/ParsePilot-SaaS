import Link from 'next/link';
import { requireServerAuth } from '@/lib/auth/server';
import { Logo } from '@/components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function NoWorkspacePage() {
  const auth = await requireServerAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          maxWidth: 460,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          boxShadow: 'var(--shadow-subtle)',
        }}
      >
        <Logo />
        <h1 style={{ marginTop: 20, fontSize: 22, letterSpacing: '-0.03em' }}>No workspace available</h1>
        <p style={{ marginTop: 8, color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.7 }}>
          Your account ({auth.user.email}) is not a member of any workspace, or the workspace has been scheduled for
          deletion. Contact the workspace owner, or sign out and create a new account.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Link
            href="/contact"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 36,
              padding: '0 14px',
              borderRadius: 6,
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Contact support
          </Link>
          <form action="/api/v1/auth/logout" method="post">
            <button
              type="submit"
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 6,
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-surface)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
