import Link from 'next/link';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { listDocuments } from '@/lib/documents/repository';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DocumentsTable } from '@/components/dashboard/DocumentsTable';
import { ButtonLink } from '@/components/ui/Button';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const auth = await requireWorkspaceAuth();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 20;

  const { documents, total } = await listDocuments({
    workspaceId: auth.workspace.id,
    skip: (page - 1) * pageSize,
    take: pageSize,
    status: 'needs_review',
    sortField: 'createdAt',
    sortDirection: 'desc',
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (nextPage: number) =>
    nextPage > 1 ? `/dashboard/review?page=${nextPage}` : '/dashboard/review';

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Quality control"
        title="Review queue"
        description={`${total} waiting for a human check`}
        actions={
          <ButtonLink href="/dashboard/documents" variant="secondary">
            All documents
          </ButtonLink>
        }
      />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Waiting for review</span>
          <span className={styles.cardHint}>{total} waiting</span>
        </div>

        {documents.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              —
            </span>
            <p className={styles.emptyTitle}>Review queue is clear</p>
            <p className={styles.emptyBody}>
              Every processed document has been accepted. New documents that need a confidence or totals check will
              appear here automatically.
            </p>
          </div>
        ) : (
          <DocumentsTable documents={documents} workspaceId={auth.workspace.id} showEmpty={false} />
        )}

        <div className={styles.cardFoot}>
          <span>
            Page {page} of {totalPages} · showing {documents.length} of {total}
          </span>
          <div className={styles.actions}>
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={styles.chip}>
                ← Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className={styles.chip}>
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className={`${styles.notice} ${styles.noticeInfo}`} role="note">
        <div>
          <strong>Why documents land here.</strong>
          <p className={styles.noticeBody}>
            The pipeline routes a document to review when required fields are missing, totals do not reconcile, a
            duplicate is suspected, or confidence is low. Mark reviewed only after checking the extracted values.
          </p>
        </div>
      </div>
    </div>
  );
}
