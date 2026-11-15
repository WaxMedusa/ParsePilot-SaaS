'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Download,
  FileText,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { apiRequest } from '@/lib/client/api';
import styles from './DashboardShell.module.css';

const WORKSPACE_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Layers },
  { href: '/dashboard/exports', label: 'Exports', icon: Download },
  { href: '/dashboard/usage', label: 'Usage', icon: BarChart3 },
];

const SETTINGS_NAV = [
  { href: '/dashboard/settings/billing', label: 'Billing', icon: Settings },
  { href: '/dashboard/settings/privacy', label: 'Privacy & data', icon: ShieldCheck },
];

type Props = {
  children: React.ReactNode;
  user: { name: string | null; email: string };
  workspace: { name: string; slug: string; planCode: string; role: string };
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children, user, workspace }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(pathname, item.href) ? styles.navActive : ''}`}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              <Icon size={15} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <p className={`${styles.navLabel} ${styles.navLabelSpaced}`}>Settings</p>
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(pathname, item.href) ? styles.navActive : ''}`}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              <Icon size={15} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFoot}>
        <div className={styles.securityNote}>
          <Lock size={12} aria-hidden="true" />
          <span>Private storage · signed links</span>
        </div>
        <div className={styles.user}>
          <span className={styles.avatar}>{initials || 'U'}</span>
          <span className={styles.userText}>
            <span className={styles.userName}>{user.name ?? 'Account'}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </span>
          <button type="button" className={styles.signOut} onClick={signOut} disabled={signingOut} title="Sign out" aria-label="Sign out">
            <LogOut size={14} />
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
      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <Logo href="/dashboard" />
        </div>
        {nav}
      </aside>

      <div className={styles.mobileBar}>
        <button type="button" className={styles.menuButton} onClick={() => setMobileOpen(true)} aria-label="Open navigation">
          <Menu size={18} />
        </button>
        <Logo href="/dashboard" />
        <span className={styles.mobilePlan}>{workspace.planCode}</span>
      </div>

      {mobileOpen ? (
        <div className={styles.mobileOverlay} role="dialog" aria-modal="true" aria-label="Navigation">
          <div className={styles.mobilePanel}>
            <div className={styles.mobileHead}>
              <Logo href="/dashboard" />
              <button type="button" className={styles.menuButton} onClick={() => setMobileOpen(false)} aria-label="Close navigation">
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
