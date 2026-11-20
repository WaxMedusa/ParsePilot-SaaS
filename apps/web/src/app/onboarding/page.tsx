import '@fontsource-variable/manrope';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { getAiSettingsView } from '@/lib/ai/settings';
import { Logo } from '@/components/ui/Logo';
import { OnboardingWizard } from './OnboardingWizard';
import styles from './Onboarding.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Set up your workspace' };

export default async function OnboardingPage() {
  const auth = await requireServerAuth('/onboarding');
  if (!auth.workspace) redirect('/dashboard/no-workspace');

  const profile = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { onboardedAt: true },
  });
  if (profile?.onboardedAt) redirect('/dashboard');

  const workspace = auth.workspace;
  const aiSettings = await getAiSettingsView(workspace.id);

  return (
    <div className={`app-scope ${styles.page}`}>
      <header className={styles.top}>
        <Logo />
        <span className={styles.topMeta}>First-time setup</span>
      </header>

      <main className={styles.panel}>
        <OnboardingWizard
          name={auth.user.name ?? ''}
          email={auth.user.email}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          canManageAi={workspace.role === 'owner' || workspace.role === 'admin'}
          encryptionAvailable={aiSettings.encryptionAvailable}
          aiConfigured={aiSettings.configured && aiSettings.enabled}
        />
      </main>

      <p className={styles.foot}>Signed in as {auth.user.email} · ParsePilot</p>
    </div>
  );
}
