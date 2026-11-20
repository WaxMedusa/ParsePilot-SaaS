import { requireWorkspaceAuth } from '@/lib/auth/server';
import { getAiSettingsView } from '@/lib/ai/settings';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { AiSettingsPanel } from '@/components/dashboard/AiSettingsPanel';
import { AiKeyGuide } from '@/components/dashboard/AiKeyGuide';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function AiSettingsPage() {
  const auth = await requireWorkspaceAuth();
  const settings = await getAiSettingsView(auth.workspace.id);
  const active = settings.configured && settings.enabled;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Settings"
        title="AI extraction"
        description="Turn on a model read of every document. It fills the fields the label rules leave blank, and the same rules still check totals, dates and currencies before anything is saved."
        actions={
          <>
            {active ? (
              <Badge tone="success" dot>
                On · {settings.model}
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Rules only
              </Badge>
            )}
            <ButtonLink href="#provider-key" variant="secondary" size="sm">
              Create a key
            </ButtonLink>
          </>
        }
      />
      <AiSettingsPanel workspaceId={auth.workspace.id} role={auth.workspace.role} initial={settings} />
      <AiKeyGuide />
    </div>
  );
}
