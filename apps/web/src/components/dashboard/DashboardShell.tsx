'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { apiRequest } from '@/lib/client/api';
import { LiveRefresh, isLiveDashboardPath } from './LiveRefresh';
import styles from './DashboardShell.module.css';

const WORKSPACE_NAV = [
  { href: '/dashboard', label: 'Overview', index: '01' },
  { href: '/dashboard/documents', label: 'Documents', index: '02' },
  { href: '/dashboard/review', label: 'Review queue', index: '03' },
  { href: '/dashboard/jobs', label: 'Jobs', index: '04' },
  { href: '/dashboard/exports', label: 'Exports', index: '05' },
  { href: '/dashboard/usage', label: 'Usage', index: '06' },
];

const SETTINGS_NAV = [
  { href: '/dashboard/settings/billing', label: 'Billing', index: '07' },
  { href: '/dashboard/settings/privacy', label: 'Privacy & data', index: '08' },
];

type Props = {
  children: React.ReactNode;
  user: { name: string | null; email: string };
  workspace: { name: string; slug: string; planCode: string; role: string };
  reviewCount: number;
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children, user, workspace, reviewCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const live = isLiveDashboardPath(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, send the operator back to sign-in.
    }
    window.location.assign('/');
  };

  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const nav = (
    <>
      <div className={styles.workspaceChip}>
        <span className={styles.workspaceMark}>{workspace.name.slice(0, 1).toUpperCase()}</span>
        <span className={styles.workspaceText}>
          <span className={styles.workspaceName}>{workspace.name}</span>
          <span className={styles.workspacePlan}>
            {workspace.planCode} plan · {workspace.role}
          </span>
        </span>
      </div>

      <nav className={styles.nav} aria-label="Dashboard">
        <p className={styles.navLabel}>Workspace</p>
        {WORKSPACE_NAV.map((item) => {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(pathname, item.href) ? styles.navActive : ''}`}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              <span className={styles.navIndex}>{item.index}</span>
              <span>{item.label}</span>
              {item.href === '/dashboard/review' && reviewCount > 0 ? (
                <span className={styles.navBadge} aria-label={`${reviewCount} waiting`}>
                  {reviewCount > 99 ? '99+' : reviewCount}
                </span>
              ) : null}
            </Link>
          );
        })}
        <p className={`${styles.navLabel} ${styles.navLabelSpaced}`}>Settings</p>
        {SETTINGS_NAV.map((item) => {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(pathname, item.href) ? styles.navActive : ''}`}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              <span className={styles.navIndex}>{item.index}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFoot}>
        {live ? (
          <div className={styles.liveNote} role="status" aria-live="polite">
            <span className={styles.liveDot} aria-hidden="true" />
            Live updates
            <span className={styles.liveHint}>every 5s</span>
          </div>
        ) : null}
        <p className={styles.securityNote}>Private storage · signed links</p>
        <div className={styles.user}>
          <span className={styles.avatar}>{initials || 'U'}</span>
          <span className={styles.userText}>
            <span className={styles.userName}>{user.name ?? 'Account'}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </span>
          <button type="button" className={styles.signOut} onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Leaving…' : 'Sign out'}
          </button>
        </div>
        <Link href="/privacy" className={styles.legalLink}>
          Privacy · Terms · Security
        </Link>
      </div>
    </>
  );

  return (
    <div className={styles.shell}>
      <LiveRefresh />
      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <Logo href="/dashboard" />
        </div>
        {nav}
      </aside>

      <div className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="dashboard-navigation"
        >
          <Menu size={18} />
        </button>
        <Logo href="/dashboard" />
        <span className={styles.mobilePlan}>{workspace.planCode}</span>
      </div>

      {mobileOpen ? (
        <div className={styles.mobileOverlay} role="dialog" aria-modal="true" aria-label="Navigation">
          <div className={styles.mobilePanel} id="dashboard-navigation">
            <div className={styles.mobileHead}>
              <Logo href="/dashboard" />
              <button type="button" className={styles.menuButton} onClick={() => setMobileOpen(false)} aria-label="Close navigation" autoFocus>
                <X size={18} />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}

      <div className={styles.main}>{children}</div>
    </div>
  );
}
