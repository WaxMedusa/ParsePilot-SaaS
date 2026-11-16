import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/auth/AuthForms';
import { getServerAuth } from '@/lib/auth/server';
import styles from '../auth-page.module.css';

export const metadata: Metadata = { title: 'Create an account' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; next?: string }> }) {
  const auth = await getServerAuth();
  if (auth) redirect('/dashboard');
  const params = await searchParams;
  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : undefined;

  return (
    <div>
      <p className={styles.eyebrow}>Start free</p>
      <h1 className={styles.title}>Create your workspace</h1>
      <p className={styles.lede}>
        Continue with Google or create an email account. The free plan includes 100 pages per month, private storage and
        the full review workflow. No card required.
      </p>
      <SignupForm plan={params.plan} next={next} />
    </div>
  );
}
