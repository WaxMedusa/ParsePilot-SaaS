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
          : 'Enter the email associated with your account. If it exists, we will send reset instructions.'}
      </p>
      {token ? <ResetConfirmForm token={token} /> : <ResetRequestForm />}
      <div className={styles.notice}>
        Reset links are single-use and expire after one hour. If the email does not arrive, check your spam folder or
        request another link.
      </div>
    </div>
  );
}
