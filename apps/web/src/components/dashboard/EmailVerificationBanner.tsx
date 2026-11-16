'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './DashboardShell.module.css';

export function EmailVerificationBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const resend = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{
        sent: boolean;
        message: string;
        developmentVerificationUrl?: string;
      }>('/api/v1/auth/email-verification/request', { method: 'POST' });
      setMessage(result.message);
      setDevUrl(result.developmentVerificationUrl ?? null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.verifyBanner} role="status">
      <div>
        <p className={styles.verifyTitle}>Verify your email address</p>
        <p className={styles.verifyBody}>
          Confirm <strong>{email}</strong> to secure recovery and account notices.{' '}
          {message ? <span className={styles.verifyMessage}>{message}</span> : null}
          {error ? <span className={styles.verifyError}>{error}</span> : null}
          {devUrl ? (
            <>
              {' '}
              <a href={devUrl} className={styles.verifyLink}>
                Open the local verification link
              </a>
              .
            </>
          ) : null}
        </p>
      </div>
      <div className={styles.verifyActions}>
        <Link href="/verify-email" className={styles.verifyLink}>
          How to verify
        </Link>
        <button type="button" className={styles.verifyButton} onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Resend email'}
        </button>
      </div>
    </div>
  );
}
