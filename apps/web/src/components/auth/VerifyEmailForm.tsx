'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './AuthForms.module.css';

export function VerifyEmailForm({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('Verifying your email address…');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    apiRequest<{ verified: boolean; email: string }>('/api/v1/auth/email-verification/confirm', {
      method: 'POST',
      body: { token },
    })
      .then((result) => {
        setStatus('done');
        setMessage(`${result.email} is verified.`);
      })
      .catch((error) => {
        setStatus('error');
        setMessage(errorMessage(error));
      });
  }, [token]);

  if (status === 'working') {
    return (
      <div className={styles.form} aria-live="polite">
        <p className={styles.hint}>{message}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.form}>
        <div className={styles.errorBox} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{message}</span>
        </div>
        <p className={styles.footnote}>
          Request a fresh link from your dashboard, then try again.{' '}
          <Link href={signedIn ? '/dashboard' : '/login'} className={styles.inlineLink}>
            Continue
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <div className={styles.successBox} role="status">
        <CheckCircle2 size={14} aria-hidden="true" />
        <p>{message}</p>
      </div>
      <Link href={signedIn ? '/dashboard' : '/login'} className={styles.submit}>
        {signedIn ? 'Return to dashboard' : 'Sign in'} <ArrowRight size={15} />
      </Link>
    </div>
  );
}
