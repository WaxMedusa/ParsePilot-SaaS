import { requireWorkspaceAuth } from '@/lib/auth/server';
import { getAiSettingsView } from '@/lib/ai/settings';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { AiSettingsPanel } from '@/components/dashboard/AiSettingsPanel';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function AiSettingsPage() {
  const auth = await requireWorkspaceAuth();
  const settings = await getAiSettingsView(auth.workspace.id);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Settings"
        title="AI extraction"
        description="Connect your own OpenAI-compatible provider for this workspace. Without a key the deterministic extraction rules run alone."
      />
      <AiSettingsPanel workspaceId={auth.workspace.id} role={auth.workspace.role} initial={settings} />
    </div>
  );
}
