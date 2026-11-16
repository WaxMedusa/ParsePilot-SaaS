'use client';

import { useState } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import styles from './AuthForms.module.css';

function safeNext(value: string | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

export function GoogleAuthButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Google sign-in is not configured for this deployment.');
      }

      try {
        sessionStorage.setItem('pp_oauth_next', safeNext(next));
      } catch {
        // Session storage can be unavailable in strict privacy modes. The
        // callback safely falls back to the dashboard.
      }

      const supabase = getSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in could not start. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.oauth}>
      {error ? (
        <div className={styles.errorBox} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}
      <button type="button" className={styles.oauthButton} onClick={start} disabled={loading}>
        <span className={styles.oauthMark} aria-hidden="true">
          G
        </span>
        {loading ? 'Redirecting to Google…' : 'Continue with Google'}
        {!loading ? <ArrowRight size={15} /> : null}
      </button>
    </div>
  );
}
