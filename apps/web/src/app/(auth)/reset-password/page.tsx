import type { Metadata } from 'next';
import { ResetConfirmForm, ResetRequestForm } from '@/components/auth/AuthForms';
import styles from '../auth-page.module.css';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = params.token;

  return (
    <div>
      <p className={styles.eyebrow}>Account recovery</p>
      <h1 className={styles.title}>{token ? 'Set a new password' : 'Reset your password'}</h1>
      <p className={styles.lede}>
        {token
          ? 'Choose a new password. All existing sessions will be signed out once it is changed.'
          : 'Enter the email associated with your account. If it exists, reset instructions will be generated.'}
      </p>
      {token ? <ResetConfirmForm token={token} /> : <ResetRequestForm />}
      <div className={styles.notice}>
        Reset tokens are single-use and expire after one hour. No transactional email provider is configured in this
        deployment, so a production password reset flow requires one to be set up.
      </div>
    </div>
  );
}
