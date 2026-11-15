import { requireWorkspaceAuth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { listActiveSessions } from '@/lib/auth/session';
import { listDataRequests } from '@/lib/privacy/data-requests';
import { listWorkspacesForUser } from '@/lib/auth/authorization';
import { retentionSummary } from '@/config/retention';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PrivacyPanel } from '@/components/dashboard/PrivacyPanel';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function PrivacySettingsPage() {
  const auth = await requireWorkspaceAuth();
  const userId = auth.user.id;

  const [account, sessions, requests, workspaces] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true, lastLoginAt: true, deletionRequestedAt: true },
    }),
    listActiveSessions(userId),
    listDataRequests(userId),
    listWorkspacesForUser(userId),
  ]);

  if (!account) {
    return (
      <div className={styles.page}>
        <PageHeader eyebrow="Settings" title="Privacy & data" description="Account not found." />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Settings"
        title="Privacy & data"
        description="Review what is stored, export a copy, revoke sessions, or schedule deletion. Destructive actions require reauthentication and run through the background retention worker."
      />
      <PrivacyPanel
        account={{
          id: account.id,
          email: account.email,
          name: account.name,
          createdAt: account.createdAt.toISOString(),
          lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
          deletionRequestedAt: account.deletionRequestedAt?.toISOString() ?? null,
        }}
        sessions={sessions.map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          lastUsedAt: session.lastUsedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          current: session.id === auth.sessionId,
        }))}
        requests={requests.map((request) => ({
          id: request.id,
          type: request.type,
          status: request.status,
          createdAt: request.createdAt.toISOString(),
          completedAt: request.completedAt?.toISOString() ?? null,
          failureReason: request.failureReason,
          resultExpiresAt: request.resultExpiresAt?.toISOString() ?? null,
        }))}
        workspaces={workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, role: workspace.role }))}
        retention={retentionSummary}
        workspaceId={auth.workspace.id}
        role={auth.workspace.role}
      />
    </div>
  );
}
