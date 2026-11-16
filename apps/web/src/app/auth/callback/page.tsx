'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from './callback.module.css';

type ExchangeResponse = {
  error?: { message?: string };
};

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

export default function AuthCallbackPage() {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finish = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const oauthError = params.get('error_description') ?? params.get('error') ?? hash.get('error_description') ?? hash.get('error');
        if (oauthError) throw new Error(oauthError);

        const supabase = getSupabaseBrowserClient();
        const current = await supabase.auth.getSession();
        if (current.error) throw current.error;
        let session = current.data.session;

        if (!session) {
          const code = params.get('code');
          if (code) {
            const exchanged = await supabase.auth.exchangeCodeForSession(code);
            if (exchanged.error) throw exchanged.error;
            session = exchanged.data.session;
          }
        }

        if (!session) {
          throw new Error('Google sign-in did not return a valid session. Please try again.');
        }

        const response = await fetch('/api/v1/auth/supabase', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${session.access_token}`,
          },
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => null)) as ExchangeResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? 'Google sign-in could not be completed.');
        }

        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

        let next = '/dashboard';
        try {
          next = safeNext(sessionStorage.getItem('pp_oauth_next'));
          sessionStorage.removeItem('pp_oauth_next');
        } catch {
          // Use the default destination when storage is unavailable.
        }
        window.location.replace(next);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Google sign-in could not be completed.');
      }
    };

    void finish();
  }, []);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Google sign-in</p>
        {error ? (
          <>
            <div className={styles.errorMark} aria-hidden="true">
              <AlertCircle size={20} />
            </div>
            <h1 className={styles.title}>Sign-in could not be completed</h1>
            <p className={styles.copy}>{error}</p>
            <Link href="/login" className={styles.action}>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div className={styles.loadingMark} aria-hidden="true">
              <LoaderCircle size={20} />
            </div>
            <h1 className={styles.title}>Completing sign-in</h1>
            <p className={styles.copy} role="status">
              Verifying your Google account and opening your workspace.
            </p>
            <div className={styles.progress} aria-hidden="true">
              <span />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
