import type { Metadata } from 'next';
import Link from 'next/link';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { getServerAuth } from '@/lib/auth/server';
import styles from '../auth-page.module.css';

export const metadata: Metadata = { title: 'Verify email' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const auth = await getServerAuth();
  const token = params.token;

  return (
    <div>
      <p className={styles.eyebrow}>Account security</p>
      <h1 className={styles.title}>{token ? 'Verify your email' : 'Check your inbox'}</h1>
      <p className={styles.lede}>
        {token
          ? 'We are confirming the address on your account. The link can only be used once.'
          : 'Open the verification link we sent to your account email. If it has expired, request a fresh link from the dashboard.'}
      </p>
      {token ? (
        <VerifyEmailForm token={token} signedIn={Boolean(auth)} />
      ) : (
        <div className={styles.notice}>
          You can close this page and return to the{' '}
          <Link href={auth ? '/dashboard' : '/login'} className={styles.inlineLink}>
            {auth ? 'dashboard' : 'sign-in page'}
          </Link>
          .
        </div>
      )}
    </div>
  );
}
