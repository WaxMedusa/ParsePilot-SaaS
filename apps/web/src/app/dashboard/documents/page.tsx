import Link from 'next/link';
import { Upload } from 'lucide-react';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { listDocuments } from '@/lib/documents/repository';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { UploadDisclosure } from '@/components/dashboard/UploadDisclosure';
import { DocumentsTable } from '@/components/dashboard/DocumentsTable';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: '', label: 'All documents' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'completed', label: 'Completed' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}) {
  const auth = await requireWorkspaceAuth();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 20;
  const status = params.status && FILTERS.some((filter) => filter.value === params.status) ? params.status : undefined;
  const search = params.search?.slice(0, 120) || undefined;

  const { documents, total } = await listDocuments({
    workspaceId: auth.workspace.id,
    skip: (page - 1) * pageSize,
    take: pageSize,
    status,
    search,
    sortField: 'createdAt',
    sortDirection: 'desc',
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const queryFor = (nextPage: number) => {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (search) query.set('search', search);
    if (nextPage > 1) query.set('page', String(nextPage));
    const qs = query.toString();
    return `/dashboard/documents${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        description={`${total} document${total === 1 ? '' : 's'}`}
        actions={
          <Link href="#upload" className={styles.tag}>
            <Upload size={12} /> Upload
          </Link>
        }
      />

      <UploadDisclosure workspaceId={auth.workspace.id} />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.filters}>
            {FILTERS.map((filter) => {
              const query = new URLSearchParams();
              if (filter.value) query.set('status', filter.value);
              if (search) query.set('search', search);
              const qs = query.toString();
              return (
                <Link
                  key={filter.value || 'all'}
                  href={`/dashboard/documents${qs ? `?${qs}` : ''}`}
                  className={`${styles.chip} ${(status ?? '') === filter.value ? styles.chipActive : ''}`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
          <form action="/dashboard/documents" method="get" className={styles.searchForm}>
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search vendor, number or file"
              className={styles.searchInput}
              aria-label="Search documents"
            />
            <button type="submit" className={styles.tag}>
              Search
            </button>
          </form>
        </div>
        <DocumentsTable documents={documents} workspaceId={auth.workspace.id} />
        <div className={styles.cardFoot}>
          <span>
            Page {page} of {totalPages} · showing {documents.length} of {total}
          </span>
          <div className={styles.actions}>
            {page > 1 ? (
              <Link href={queryFor(page - 1)} className={styles.chip}>
                ← Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={queryFor(page + 1)} className={styles.chip}>
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

    </div>
  );
}
