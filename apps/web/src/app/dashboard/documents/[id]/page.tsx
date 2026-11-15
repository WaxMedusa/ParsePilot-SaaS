import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Download, FileText } from 'lucide-react';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { getDocumentDetail } from '@/lib/documents/service';
import { getUsageSnapshot } from '@/lib/billing/usage';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DocumentActions } from '@/components/dashboard/DocumentActions';
import { FieldEditor } from '@/components/dashboard/FieldEditor';
import { StatusPoller } from '@/components/dashboard/StatusPoller';
import { StatusBadge } from '@/components/ui/Badge';
import { roleAtLeast } from '@/lib/auth/authorization';
import { formatBytes, formatDateTime } from '@/lib/format';
import styles from '@/components/dashboard/Dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspaceAuth();
  const { id } = await params;

  let detail;
  try {
    detail = await getDocumentDetail(id, auth.workspace.id);
  } catch {
    notFound();
  }

  const usage = await getUsageSnapshot(auth.workspace.id);
  const canEdit = roleAtLeast(auth.workspace.role, 'member');
  const canRetry = Boolean(detail.jobs.find((job) => job.status === 'failed' || job.status === 'dead_letter'));
  const terminal = ['completed', 'needs_review', 'failed'].includes(detail.status);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={
          <>
            <Link href="/dashboard/documents" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={11} /> Documents
            </Link>
          </>
        }
        title={detail.originalName}
        description={`${detail.kind} · ${formatBytes(detail.sizeBytes)} · ${detail.pageCount ?? '—'} page(s) · SHA-256 ${detail.checksumSha256.slice(0, 12)}…`}
        actions={<StatusBadge status={detail.status} />}
      />

      {!terminal ? <StatusPoller documentId={detail.id} workspaceId={auth.workspace.id} initialStatus={detail.status} /> : null}

      {detail.status === 'failed' ? (
        <div className={`${styles.notice} ${styles.noticeDanger}`} role="alert">
          <AlertTriangle size={14} />
          <div>
            <strong>Processing failed{detail.failureCode ? ` (${detail.failureCode})` : ''}.</strong>
            <p style={{ marginTop: 3 }}>{detail.failureMessage ?? 'The worker reported a failure. Review the job timeline and retry.'}</p>
          </div>
        </div>
      ) : null}

      {detail.duplicateOfId ? (
        <div className={`${styles.notice} ${styles.noticeWarning}`} role="note">
          <AlertTriangle size={14} />
          <div>
            <strong>This document looks like a duplicate{detail.duplicateScore ? ` (${Math.round(detail.duplicateScore * 100)}% match)` : ''}.</strong>
            <p style={{ marginTop: 3 }}>
              It matches another document in this workspace. <Link href={`/dashboard/documents/${detail.duplicateOfId}`}>Open the earlier document</Link> before
              approving it for export.
            </p>
          </div>
        </div>
      ) : null}

      <DocumentActions documentId={detail.id} workspaceId={auth.workspace.id} status={detail.status} canRetry={canRetry} />

      <div className={styles.split}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Extracted fields</span>
            <span className={styles.cardHint}>
              {detail.extraction ? `${detail.extraction.fields.length} fields · ${detail.extraction.provider ?? 'pipeline'}` : 'pending'}
            </span>
          </div>
          <div className={styles.cardBody}>
            <FieldEditor
              documentId={detail.id}
              workspaceId={auth.workspace.id}
              fields={detail.extraction?.fields ?? []}
              canEdit={canEdit}
              version={detail.extraction?.version ?? null}
            />
          </div>
          <div className={styles.cardFoot}>
            <span>
              {detail.extraction?.ocrUsed ? 'OCR was used for this document' : 'Native text extraction only'}
              {detail.extraction?.pagesProcessed ? ` · ${detail.extraction.pagesProcessed} pages` : ''}
            </span>
            <span>{detail.extraction?.completedAt ? formatDateTime(detail.extraction.completedAt) : '—'}</span>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Document metadata</span>
              <span className={styles.cardHint}>private</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.kv}>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Status</span>
                  <span className={styles.kvValue}>
                    <StatusBadge status={detail.status} />
                  </span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Type</span>
                  <span className={styles.kvValue}>{detail.kind}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Pages</span>
                  <span className={styles.kvValue}>{detail.pageCount ?? '—'}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Size</span>
                  <span className={`${styles.kvValue} ${styles.kvMono}`}>{formatBytes(detail.sizeBytes)}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Uploaded</span>
                  <span className={`${styles.kvValue} ${styles.kvMono}`}>{formatDateTime(detail.createdAt)}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Uploaded by</span>
                  <span className={styles.kvValue}>{detail.uploadedBy.name ?? detail.uploadedBy.email}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Language</span>
                  <span className={styles.kvValue}>{detail.language ?? '—'}</span>
                </div>
              </div>
              <p className={styles.hint} style={{ marginTop: 10 }}>
                <Download size={10} /> Downloads use a signed link that expires in minutes. Storage keys are random and not
                derived from the filename.
              </p>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Job timeline</span>
              <span className={styles.cardHint}>{detail.jobs.length} job(s)</span>
            </div>
            <div className={styles.cardBody}>
              {detail.jobs.length === 0 ? (
                <p className={styles.sectionBody}>No jobs recorded for this document.</p>
              ) : (
                <ul className={styles.timeline}>
                  {detail.jobs.map((job) => (
                    <li key={job.id} className={styles.timelineItem}>
                      <span
                        className={`${styles.timelineDot} ${
                          job.status === 'succeeded'
                            ? styles.timelineDotDone
                            : job.status === 'failed' || job.status === 'dead_letter'
                              ? styles.timelineDotError
                              : styles.timelineDotActive
                        }`}
                      />
                      <div>
                        <p className={styles.timelineLabel}>
                          {job.status === 'running' && job.stage ? job.stage.replace(/_/g, ' ') : job.status.replace(/_/g, ' ')}
                        </p>
                        <p className={styles.timelineMeta}>
                          Attempt {job.attempts}/{job.maxAttempts} · {formatDateTime(job.createdAt)}
                          {job.errorCode ? ` · ${job.errorCode}` : ''}
                        </p>
                        {job.errorMessage ? <p className={styles.timelineMeta}>{job.errorMessage.slice(0, 160)}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.cardFoot}>
              <span>
                <FileText size={10} /> Pages this period: {usage.usage.pagesUsed}/{usage.plan.monthlyPageLimit}
              </span>
              <Link href="/dashboard/jobs" className={styles.cardHint}>
                All jobs →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
