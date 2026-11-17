import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireWorkspaceAuth } from '@/lib/auth/server';
import { getDocumentDetail } from '@/lib/documents/service';
import { getUsageSnapshot } from '@/lib/billing/usage';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { DocumentActions } from '@/components/dashboard/DocumentActions';
import { DocumentPreview } from '@/components/dashboard/DocumentPreview';
import { FieldEditor } from '@/components/dashboard/FieldEditor';
import { StatusPoller } from '@/components/dashboard/StatusPoller';
import { StatusBadge } from '@/components/ui/Badge';
import { roleAtLeast } from '@/lib/auth/authorization';
import { formatBytes, formatDateTime } from '@/lib/format';
import layout from '@/components/dashboard/Dashboard.module.css';
import styles from './DocumentReview.module.css';

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
  const canReview = detail.status === 'needs_review' && canEdit;
  const terminal = ['completed', 'needs_review', 'failed'].includes(detail.status);
  const metadata = (detail.metadata ?? {}) as { validationIssues?: unknown };
  const reviewIssues = Array.isArray(metadata.validationIssues)
    ? metadata.validationIssues.filter((issue): issue is string => typeof issue === 'string')
    : [];
  const fields = detail.extraction?.fields ?? [];
  const extractionWarnings = detail.extraction?.warnings ?? [];
  const aiErrorDetail = extractionWarnings.find((warning) => warning.startsWith('ai_provider_error:'));

  return (
    <div className={layout.page}>
      <PageHeader
        eyebrow={<Link href="/dashboard/documents">← Documents</Link>}
        title={detail.originalName}
        description={`${detail.kind} · ${formatBytes(detail.sizeBytes)} · ${detail.pageCount ?? '—'} page(s) · SHA-256 ${detail.checksumSha256.slice(0, 12)}…`}
        actions={<StatusBadge status={detail.status} />}
      />

      {!terminal ? <StatusPoller documentId={detail.id} workspaceId={auth.workspace.id} initialStatus={detail.status} /> : null}

      {detail.status === 'failed' ? (
        <div className={`${layout.notice} ${layout.noticeDanger}`} role="alert">
          <div>
            <strong>Processing failed{detail.failureCode ? ` (${detail.failureCode})` : ''}.</strong>
            <p className={styles.noticeBody}>{detail.failureMessage ?? 'The worker reported a failure. Review the job timeline and retry.'}</p>
          </div>
        </div>
      ) : null}

      {extractionWarnings.includes('ai_extraction_failed') ? (
        <div className={`${layout.notice} ${layout.noticeWarning}`} role="note">
          <div>
            <strong>The AI model did not read this document.</strong>
            <p className={styles.noticeBody}>
              {aiErrorDetail
                ? `The provider rejected the request: ${aiErrorDetail.replace(/^ai_provider_error:/, '')}. The values below come from the built-in rules.`
                : 'The provider could not be reached, so the values below come from the built-in rules.'}
            </p>
          </div>
        </div>
      ) : null}

      {detail.status === 'needs_review' ? (
        <div className={`${layout.notice} ${layout.noticeWarning}`} role="note">
          <div>
            <strong>This document needs a human check before it leaves the review queue.</strong>
            <p className={styles.noticeBody}>
              {reviewIssues.length > 0
                ? reviewIssues.slice(0, 4).join(' · ')
                : 'One or more extracted values need confirmation.'}
            </p>
            <p className={styles.noticeBody}>
              {canEdit
                ? 'Correct any fields in the ledger, then choose Mark reviewed. The queue count updates automatically.'
                : 'A workspace member or admin can correct the fields and mark this document reviewed.'}
            </p>
          </div>
        </div>
      ) : null}

      {detail.duplicateOfId ? (
        <div className={`${layout.notice} ${layout.noticeWarning}`} role="note">
          <div>
            <strong>This document looks like a duplicate{detail.duplicateScore ? ` (${Math.round(detail.duplicateScore * 100)}% match)` : ''}.</strong>
            <p className={styles.noticeBody}>
              It matches another document in this workspace.{' '}
              <Link href={`/dashboard/documents/${detail.duplicateOfId}`}>Open the earlier document</Link> before approving it for export.
            </p>
          </div>
        </div>
      ) : null}

      <DocumentActions
        documentId={detail.id}
        workspaceId={auth.workspace.id}
        status={detail.status}
        canRetry={canRetry}
        canReview={canReview}
      />

      <div className={styles.reviewGrid}>
        <div className={styles.previewColumn}>
          <DocumentPreview
            documentId={detail.id}
            originalName={detail.originalName}
            mimeType={detail.mimeType}
            pageCount={detail.pageCount}
          />
          <p className={styles.sourceNote}>
            The source stays private. This preview uses an authenticated route scoped to this workspace; download links
            are signed separately and expire in minutes.
          </p>
        </div>

        <div className={styles.dataColumn}>
          <section className={styles.workspaceSection} aria-labelledby="review-fields-title">
            <div className={styles.workspaceHead}>
              <div>
                <p className={styles.workspaceKicker}>Extraction / review workspace</p>
                <h2 id="review-fields-title" className={styles.workspaceTitle}>
                  Verify the extracted fields
                </h2>
              </div>
              <span className={styles.workspaceMeta}>
                {fields.length} fields{detail.extraction?.version ? ` · v${detail.extraction.version}` : ''}
              </span>
            </div>
            <p className={styles.workspaceIntro}>
              A score next to a value is the extractor&apos;s own confidence, not a guarantee. Original values sit beside
              any correction so the audit trail can reconstruct what changed and when.
            </p>
            <FieldEditor
              documentId={detail.id}
              workspaceId={auth.workspace.id}
              fields={fields}
              canEdit={canEdit}
              version={detail.extraction?.version ?? null}
            />
            <div className={styles.workspaceFoot}>
              <span>
                {detail.extraction?.ocrUsed ? 'OCR fallback used' : 'Native text extraction only'}
                {detail.extraction?.pagesProcessed ? ` · ${detail.extraction.pagesProcessed} pages` : ''}
              </span>
              <span>{detail.extraction?.completedAt ? formatDateTime(detail.extraction.completedAt) : '—'}</span>
            </div>
          </section>

          <section className={layout.card}>
            <div className={layout.cardHead}>
              <span className={layout.cardTitle}>Document metadata</span>
              <span className={layout.cardHint}>private</span>
            </div>
            <div className={layout.cardBody}>
              <div className={layout.kv}>
                <div className={layout.kvRow}>
                  <span className={layout.kvLabel}>Status</span>
                  <span className={layout.kvValue}>
                    <StatusBadge status={detail.status} />
                  </span>
                </div>
                <div className={layout.kvRow}>
                  <span className={layout.kvLabel}>Type</span>
                  <span className={layout.kvValue}>{detail.kind}</span>
                </div>
                <div className={layout.kvRow}>
                  <span className={layout.kvLabel}>Pages</span>
                  <span className={layout.kvValue}>{detail.pageCount ?? '—'}</span>
                </div>
                <div className={layout.kvRow}>
                  <span className={layout.kvLabel}>Size</span>
                  <span className={`${layout.kvValue} ${layout.kvMono}`}>{formatBytes(detail.sizeBytes)}</span>
                </div>
                <div className={layout.kvRow}>
                  <span className={layout.kvLabel}>Uploaded</span>
                  <span className={`${layout.kvValue} ${layout.kvMono}`}>{formatDateTime(detail.createdAt)}</span>
                </div>
                <div className={layout.kvRow}>
                  <span className={layout.kvLabel}>Uploaded by</span>
                  <span className={layout.kvValue}>{detail.uploadedBy.name ?? detail.uploadedBy.email}</span>
                </div>
                <div className={layout.kvRow}>
                  <span className={layout.kvLabel}>Language</span>
                  <span className={layout.kvValue}>{detail.language ?? '—'}</span>
                </div>
              </div>
              <p className={styles.metadataNote}>
                Downloads use a signed link that expires in minutes. Storage keys are random and not derived from the
                filename.
              </p>
            </div>
          </section>

          <section className={layout.card}>
            <div className={layout.cardHead}>
              <span className={layout.cardTitle}>Job timeline</span>
              <span className={layout.cardHint}>{detail.jobs.length} job(s)</span>
            </div>
            <div className={layout.cardBody}>
              {detail.jobs.length === 0 ? (
                <p className={layout.sectionBody}>No jobs recorded for this document.</p>
              ) : (
                <ul className={layout.timeline}>
                  {detail.jobs.map((job) => (
                    <li key={job.id} className={layout.timelineItem}>
                      <span
                        className={`${layout.timelineDot} ${
                          job.status === 'succeeded'
                            ? layout.timelineDotDone
                            : job.status === 'failed' || job.status === 'dead_letter'
                              ? layout.timelineDotError
                              : layout.timelineDotActive
                        }`}
                      />
                      <div>
                        <p className={layout.timelineLabel}>
                          {job.status === 'running' && job.stage ? job.stage.replace(/_/g, ' ') : job.status.replace(/_/g, ' ')}
                        </p>
                        <p className={layout.timelineMeta}>
                          Attempt {job.attempts}/{job.maxAttempts} · {formatDateTime(job.createdAt)}
                          {job.errorCode ? ` · ${job.errorCode}` : ''}
                        </p>
                        {job.errorMessage ? <p className={layout.timelineMeta}>{job.errorMessage.slice(0, 160)}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={layout.cardFoot}>
              <span>Pages this period: {usage.usage.pagesUsed}/{usage.plan.monthlyPageLimit}</span>
              <Link href="/dashboard/jobs">All jobs ↗</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
