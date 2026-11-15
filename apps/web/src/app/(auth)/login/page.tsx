import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/AuthForms';
import { getServerAuth } from '@/lib/auth/server';
import styles from '../auth-page.module.css';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const auth = await getServerAuth();
  if (auth) redirect('/dashboard');
  const params = await searchParams;
  const next = params.next && params.next.startsWith('/') ? params.next : undefined;

  return (
    <div>
      <p className={styles.eyebrow}>Welcome back</p>
      <h1 className={styles.title}>Sign in to your workspace</h1>
      <p className={styles.lede}>Use the email and password you registered with.</p>
      <LoginForm next={next} />
    </div>
  );
}
