'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export const LIVE_REFRESH_INTERVAL_MS = 5_000;

const LIVE_PATHS = new Set([
  '/dashboard',
  '/dashboard/documents',
  '/dashboard/jobs',
  '/dashboard/review',
  '/dashboard/exports',
  '/dashboard/usage',
]);

export function isLiveDashboardPath(pathname: string): boolean {
  return LIVE_PATHS.has(pathname);
}

/**
 * Refreshes server-rendered dashboard data in place. This keeps statuses,
 * counts and review work current without a browser reload. Polling pauses while
 * the tab is hidden and resumes immediately when it becomes visible again.
 */
export function LiveRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLiveDashboardPath(pathname)) return;

    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = window.setInterval(refresh, LIVE_REFRESH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pathname, router]);

  return null;
}
