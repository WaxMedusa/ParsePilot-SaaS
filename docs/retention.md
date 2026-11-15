# Retention

Retention is configured in `apps/web/src/config/retention.ts` and enforced by the retention service
(`src/lib/retention/service.ts`) through the scheduler's hourly sweep. The legal pages quote the same defaults; keep
them in sync.

| Data | Default | Environment variable | Enforcement |
| --- | --- | --- | --- |
| Soft-deleted documents (DB + object) | 30 days | `RETENTION_SOFT_DELETED_DOCUMENT_DAYS` | purge when `purgeAfter <= now` |
| Generated exports | 7 days | `RETENTION_EXPORT_DAYS` | expire, then delete object |
| Sessions | 30 days absolute | `RETENTION_SESSION_DAYS` | session resolution rejects expired tokens |
| Password reset tokens | 60 minutes | `RETENTION_PASSWORD_RESET_MINUTES` | single-use, expiry checked |
| Account deletion grace period | 30 days | `RETENTION_ACCOUNT_DELETION_GRACE_DAYS` | deletion request executed after grace |
| Data-request artefacts | 7 days | `RETENTION_DATA_REQUEST_ARTEFACT_DAYS` | signed download rejects expired artefacts |
| Signed URLs | 300 seconds | `RETENTION_SIGNED_URL_SECONDS` | signature expiry |
| Stalled jobs re-announced | 20 minutes | `RETENTION_STALLED_JOB_MINUTES` | reconciler |
| Audit logs | 730 days | `RETENTION_AUDIT_LOG_DAYS` | documented; prune job |
| Backups | 30 days | `RETENTION_BACKUP_DAYS` | infrastructure policy |

Billing records may need to be kept longer where tax/accounting law requires (documented as up to seven years on the
privacy page). Retention does not override a legal hold: if a hold is recorded, pause deletion for that tenant and
document the reason.

## User-facing deletion

- Deleting a document revokes access immediately (`deletedAt`), cancels queued jobs and schedules the object and
  extraction rows for purge after the soft-delete window.
- Workspace deletion is owner-only, requires typed confirmation, and schedules all documents, exports and storage
  objects.
- Account deletion requires the password plus typed confirmation. Sole-owner workspaces are deleted; workspaces with
  other members block deletion until ownership is transferred. Sessions are revoked and a grace period applies.
- Backups may retain copies until rotation. This is disclosed on the privacy page.

## Verification

```sql
SELECT count(*) FROM "Document" WHERE "deletedAt" IS NOT NULL AND "purgeAfter" < now();
SELECT count(*) FROM "Export" WHERE status = 'completed' AND "expiresAt" < now();
```

Both should trend to zero after a sweep. If not, inspect the scheduler logs and `DeletionRecord.status`.
