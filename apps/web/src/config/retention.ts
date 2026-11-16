/**
 * Retention configuration. Every period here is enforced by the retention
 * service and background sweep — the legal pages quote these same values.
 * Override per environment with the documented environment variables.
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const retentionConfig = {
  /** Soft-deleted documents are purged (DB + object storage) after this window. */
  softDeletedDocumentDays: intEnv('RETENTION_SOFT_DELETED_DOCUMENT_DAYS', 30),
  /** Generated exports expire and are removed from storage. */
  exportDays: intEnv('RETENTION_EXPORT_DAYS', 7),
  /** Absolute session lifetime. */
  sessionDays: intEnv('RETENTION_SESSION_DAYS', 30),
  /** Password reset token lifetime in minutes. */
  passwordResetMinutes: intEnv('RETENTION_PASSWORD_RESET_MINUTES', 60),
  /** Email verification token lifetime in minutes. */
  emailVerificationMinutes: intEnv('RETENTION_EMAIL_VERIFICATION_MINUTES', 24 * 60),
  /** Workspace invitation lifetime in days. */
  invitationDays: intEnv('RETENTION_INVITATION_DAYS', 7),
  /** Audit log retention. */
  auditLogDays: intEnv('RETENTION_AUDIT_LOG_DAYS', 730),
  /** Completed data-request artefacts (e.g. account export bundles). */
  dataRequestArtefactDays: intEnv('RETENTION_DATA_REQUEST_ARTEFACT_DAYS', 7),
  /** Signed download URL lifetime in seconds. */
  signedUrlSeconds: intEnv('RETENTION_SIGNED_URL_SECONDS', 300),
  /** Account deletion: documented grace period before hard deletion. */
  accountDeletionGraceDays: intEnv('RETENTION_ACCOUNT_DELETION_GRACE_DAYS', 30),
  /** Frequency of the retention sweep. */
  sweepIntervalMinutes: intEnv('RETENTION_SWEEP_INTERVAL_MINUTES', 60),
  /** Backup retention for the documented backup procedure. */
  backupDays: intEnv('RETENTION_BACKUP_DAYS', 30),
  /** Documents stuck in a non-terminal processing state are re-queued after this. */
  stalledJobMinutes: intEnv('RETENTION_STALLED_JOB_MINUTES', 20),
} as const;

export const retentionSummary = {
  softDeletedDocumentPurgeDays: retentionConfig.softDeletedDocumentDays,
  exportExpiryDays: retentionConfig.exportDays,
  sessionAbsoluteDays: retentionConfig.sessionDays,
  auditLogMonths: Math.round(retentionConfig.auditLogDays / 30),
  backupRetentionDays: retentionConfig.backupDays,
  billingRecordYears: 7,
};
