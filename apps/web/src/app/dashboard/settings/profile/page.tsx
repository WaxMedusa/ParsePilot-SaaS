import Link from 'next/link';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { getUsageSnapshot } from '@/lib/billing/usage';
import { avatarUrl } from '@/lib/profile/avatar';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { ProfileSettings } from '@/components/dashboard/ProfileSettings';
import { StorageSettings } from '@/components/dashboard/StorageSettings';
import { getDriveStatus } from '@/lib/integrations/google-drive';
import styles from '@/components/dashboard/ProfileSettings.module.css';

export const dynamic = 'force-dynamic';

function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireWorkspaceAuth();
  const params = await searchParams;
  const driveState = typeof params.drive === 'string' ? params.drive : null;
  const [user, usage, driveStatus] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { email: true, name: true, avatarUpdatedAt: true, emailVerifiedAt: true },
    }),
    getUsageSnapshot(auth.workspace.id),
    getDriveStatus(auth.user.id).catch(() => null),
  ]);

  const premium = auth.workspace.planCode !== 'free';
  const percent = Math.min(100, usage.usage.percentUsed);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={`${auth.workspace.name} / settings`}
        title="Profile"
        description="Your picture, your name, your plan."
        actions={
          <Link href="/dashboard" className={styles.secondary}>
            Back to workspace
          </Link>
        }
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <ProfileSettings
            name={user?.name ?? null}
            email={user?.email ?? auth.user.email}
            initials={initialsOf(user?.name ?? null, user?.email ?? auth.user.email)}
            avatarUrl={avatarUrl(user?.avatarUpdatedAt)}
            emailVerified={Boolean(user?.emailVerifiedAt)}
          />

          <StorageSettings status={driveStatus} driveState={driveState} />
        </div>

        <aside className={styles.aside}>
          <section className={styles.planCard}>
            <div className={styles.planTop}>
              <span className={styles.planLabel}>Current plan</span>
              <span className={`${styles.pill} ${premium ? styles.pillAccent : styles.pillGood}`}>
                {premium ? 'Premium' : 'Free'}
              </span>
            </div>
            <h2 className={styles.planName}>
              {premium ? <em>{usage.plan.name}</em> : usage.plan.name}
            </h2>
            <p className={styles.planPrice}>
              {usage.plan.priceCents === 0 ? 'No card on file' : `${(usage.plan.priceCents / 100).toFixed(0)} ${usage.plan.currency} / month`}
            </p>

            <div className={styles.planMeter} role="img" aria-label={`${percent}% of monthly pages used`}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <div className={styles.planKv}>
              <span>Pages</span>
              <strong>
                {usage.usage.pagesUsed} / {usage.plan.monthlyPageLimit}
              </strong>
            </div>
            <div className={styles.planKv}>
              <span>Uploads</span>
              <strong>{usage.plan.maxUploadMb} MB max</strong>
            </div>
            <div className={styles.planKv}>
              <span>Seats</span>
              <strong>{usage.plan.maxMembers}</strong>
            </div>

            <div className={styles.planFoot}>
              <Link href="/dashboard/settings/billing" className={styles.planLink}>
                Billing & invoices
              </Link>
              <Link href="/pricing" className={styles.planLink}>
                Compare plans
              </Link>
            </div>
          </section>

          <section className={styles.noteCard}>
            <p className={styles.noteTitle}>Private by default</p>
            <p className={styles.noteBody}>
              Your picture is a private object like every document: only your signed-in session can read it.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
