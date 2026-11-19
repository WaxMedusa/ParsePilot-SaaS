'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps an open live view current without a manual reload. `router.refresh`
 * re-runs the server component, so new documents and edits appear in place.
 */
export function LiveRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), seconds * 1_000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);

  return null;
}
