import { requireServerAuth } from '@/lib/auth/server';
import { countDocumentsByStatus } from '@/lib/documents/repository';
import { prisma } from '@/lib/prisma';
import { avatarUrl } from '@/lib/profile/avatar';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireServerAuth();
  if (!auth.workspace) {
    return <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>{children}</div>;
  }
  const [counts, profile] = await Promise.all([
    countDocumentsByStatus(auth.workspace.id),
    prisma.user.findUnique({ where: { id: auth.user.id }, select: { avatarUpdatedAt: true } }),
  ]);

  return (
    <DashboardShell
      user={{
        name: auth.user.name,
        email: auth.user.email,
        emailVerified: Boolean(auth.user.emailVerifiedAt),
        avatarUrl: avatarUrl(profile?.avatarUpdatedAt),
      }}
      workspace={{
        id: auth.workspace.id,
        name: auth.workspace.name,
        slug: auth.workspace.slug,
        planCode: auth.workspace.planCode,
        role: auth.workspace.role,
      }}
      workspaces={auth.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        planCode: workspace.planCode,
        role: workspace.role,
      }))}
      reviewCount={counts.needs_review ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
