import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Audit trail for sensitive operations (document access changes, edits,
 * deletions, billing and privacy actions). Audit writes never break the
 * primary operation; failures are logged for follow-up.
 */

export type AuditAction =
  | 'auth.signup'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'auth.email_verified'
  | 'workspace.created'
  | 'workspace.invitation_sent'
  | 'workspace.invitation_revoked'
  | 'workspace.invitation_accepted'
  | 'workspace.member_role_changed'
  | 'workspace.member_removed'
  | 'settings.ai_updated'
  | 'settings.ai_cleared'
  | 'document.uploaded'
  | 'document.viewed'
  | 'document.updated'
  | 'document.field_edited'
  | 'document.deleted'
  | 'document.purged'
  | 'document.download_url_created'
  | 'document.processed'
  | 'document.reviewed'
  | 'document.process_failed'
  | 'job.retried'
  | 'job.dead_lettered'
  | 'export.created'
  | 'export.downloaded'
  | 'export.expired'
  | 'billing.checkout_started'
  | 'billing.portal_opened'
  | 'billing.webhook_processed'
  | 'billing.subscription_updated'
  | 'privacy.data_export_requested'
  | 'privacy.account_deletion_requested'
  | 'privacy.account_deletion_cancelled'
  | 'privacy.workspace_deletion_requested'
  | 'privacy.request_completed'
  | 'session.revoked'
  | 'retention.sweep'
  | 'security.incident_recorded';

export async function recordAudit(entry: {
  action: AuditAction;
  workspaceId?: string | null;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  requestId?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        workspaceId: entry.workspaceId ?? null,
        actorId: entry.actorId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        metadata: (entry.metadata ?? undefined) as never,
        ipHash: entry.ipHash ?? null,
        requestId: entry.requestId ?? null,
      },
    });
  } catch (error) {
    logger.error('audit_write_failed', {
      action: entry.action,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
