import { requireWorkspaceAuth } from '@/lib/auth/server';
import { listExports } from '@/lib/exports/service';
import { getUsageSnapshot } from '@/lib/billing/usage';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { ExportsPanel } from '@/components/dashboard/ExportsPanel';
import { roleAtLeast } from '@/lib/auth/authorization';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function ExportsPage() {
  const auth = await requireWorkspaceAuth();
  const [exports, usage] = await Promise.all([
    listExports(auth.workspace.id),
    getUsageSnapshot(auth.workspace.id),
  ]);

  const canCreate = roleAtLeast(auth.workspace.role, 'member');
  const xlsxAllowed = usage.plan.features.some((feature) => /xlsx/i.test(feature));

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Data out"
        title="Exports"
        description="Generate CSV or XLSX files from reviewed documents. Files are built by the background worker, stored privately and expire automatically."
      />
      <ExportsPanel
        workspaceId={auth.workspace.id}
        canCreate={canCreate}
        xlsxAllowed={xlsxAllowed}
        initialExports={exports.map((entry) => ({
          id: entry.id,
          format: entry.format,
          status: entry.status,
          rowCount: entry.rowCount,
          sizeBytes: entry.sizeBytes,
          expiresAt: entry.expiresAt?.toISOString() ?? null,
          createdAt: entry.createdAt.toISOString(),
          completedAt: entry.completedAt?.toISOString() ?? null,
          errorMessage: entry.errorMessage,
        }))}
      />
    </div>
  );
}
