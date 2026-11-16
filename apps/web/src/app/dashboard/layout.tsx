import { requireServerAuth } from '@/lib/auth/server';
import { countDocumentsByStatus } from '@/lib/documents/repository';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireServerAuth();
  if (!auth.workspace) {
    return <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>{children}</div>;
  }
  const counts = await countDocumentsByStatus(auth.workspace.id);

  return (
    <DashboardShell
      user={{ name: auth.user.name, email: auth.user.email }}
      workspace={{
        name: auth.workspace.name,
        slug: auth.workspace.slug,
        planCode: auth.workspace.planCode,
        role: auth.workspace.role,
      }}
      reviewCount={counts.needs_review ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
