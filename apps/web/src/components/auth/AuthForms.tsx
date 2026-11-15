'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/client/api';
import styles from './AuthForms.module.css';

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={styles.errorBox} role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/auth/login', { method: 'POST', body: { email, password } });
      window.location.assign(next && next.startsWith('/') ? next : '/dashboard');
    } catch (caught) {
      setError(errorMessage(caught));
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ErrorBox message={error} />
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
        />
      </label>
      <div className={styles.rowBetween}>
        <Link href="/reset-password" className={styles.inlineLink}>
          Forgot password?
        </Link>
      </div>
      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
        {!loading ? <ArrowRight size={15} /> : null}
      </button>
      <p className={styles.footnote}>
        New to ParsePilot?{' '}
        <Link href="/signup" className={styles.inlineLink}>
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm({ plan }: { plan?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/auth/signup', {
        method: 'POST',
        body: {
          name: name || undefined,
          email,
          password,
          workspaceName: workspaceName || undefined,
        },
      });
      const destination = plan ? `/dashboard/settings/billing?plan=${encodeURIComponent(plan)}` : '/dashboard';
      window.location.assign(destination);
    } catch (caught) {
      setError(errorMessage(caught));
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ErrorBox message={error} />
      <label className={styles.field}>
        <span className={styles.label}>Your name</span>
        <input
          className={styles.input}
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Alex Morgan"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Work email</span>
        <input
          className={styles.input}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Workspace name</span>
        <input
          className={styles.input}
          type="text"
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder="Northwind Finance"
        />
        <span className={styles.hint}>You can rename this later. You will be the workspace owner.</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 10 characters"
        />
        <span className={styles.hint}>At least 10 characters, including upper and lower case letters and a number.</span>
      </label>
      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
        {!loading ? <ArrowRight size={15} /> : null}
      </button>
      <p className={styles.terms}>
        By creating an account you agree to the{' '}
        <Link href="/terms" className={styles.inlineLink}>
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className={styles.inlineLink}>
          Privacy Policy
        </Link>
        . You are starting on the free plan; no card is required.
      </p>
      <p className={styles.footnote}>
        Already have an account?{' '}
        <Link href="/login" className={styles.inlineLink}>
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetRequestForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ message: string; developmentResetUrl?: string }>('/api/v1/auth/password-reset/request', {
        method: 'POST',
        body: { email },
      });
      setMessage(result.message);
      setDevUrl(result.developmentResetUrl ?? null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ErrorBox message={error} />
      {message ? (
        <div className={styles.successBox} role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <div>
            <p>{message}</p>
            {devUrl ? (
              <p className={styles.devNote}>
                No email provider is configured in this development deployment. Use this one-time link:{' '}
                <a href={devUrl} className={styles.inlineLink}>
                  set a new password
                </a>
                .
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
      </label>
      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Requesting…' : 'Request password reset'}
        {!loading ? <ArrowRight size={15} /> : null}
      </button>
      <p className={styles.footnote}>
        Remembered it?{' '}
        <Link href="/login" className={styles.inlineLink}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/v1/auth/password-reset/confirm', { method: 'POST', body: { token, password } });
      setMessage('Password updated. All existing sessions have been signed out.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div className={styles.form}>
        <div className={styles.successBox} role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <p>{message}</p>
        </div>
        <Link href="/login" className={styles.submit}>
          Sign in with your new password <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ErrorBox message={error} />
      <label className={styles.field}>
        <span className={styles.label}>New password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <span className={styles.hint}>At least 10 characters with upper and lower case letters and a number.</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Confirm new password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>
      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Updating…' : 'Set new password'}
        {!loading ? <ArrowRight size={15} /> : null}
      </button>
    </form>
  );
}
