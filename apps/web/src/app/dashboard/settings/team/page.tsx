import { redirect } from 'next/navigation';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { getTeamSnapshot } from '@/lib/workspaces/team';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TeamPanel } from '@/components/dashboard/TeamPanel';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function TeamSettingsPage() {
  const auth = await requireWorkspaceAuth();
  if (auth.workspace.role !== 'owner' && auth.workspace.role !== 'admin') {
    redirect('/dashboard');
  }
  const team = await getTeamSnapshot(auth.workspace.id);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Settings"
        title="Team"
        description="Invite teammates by email and manage their workspace role. Seats are enforced by the current plan."
      />
      <TeamPanel
        workspaceId={auth.workspace.id}
        workspaceName={auth.workspace.name}
        currentUserId={auth.user.id}
        role={auth.workspace.role}
        planCode={team.planCode}
        maxMembers={team.maxMembers}
        members={team.members.map((member) => ({
          id: member.id,
          role: member.role,
          createdAt: member.createdAt.toISOString(),
          userId: member.userId,
          email: member.email,
          name: member.name,
          lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
        }))}
        invitations={team.invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          createdAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
          invitedBy: invitation.invitedBy,
        }))}
      />
    </div>
  );
}
