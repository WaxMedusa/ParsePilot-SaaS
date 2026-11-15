# Backup and recovery

## What must be backed up

| Asset | Method | Frequency | Retention |
| --- | --- | --- | --- |
| PostgreSQL | `pg_dump --format=custom` + WAL/PITR on managed instances | daily full, continuous WAL | 30 days (configurable) |
| Object storage | bucket versioning + cross-region replication or `mc mirror` / `aws s3 sync` | daily | 30 days |
| Secrets | secret manager export procedure (never in the database backup) | on rotation | per policy |
| Configuration | infrastructure as code / this repository | every change | git history |

Signed URLs are short-lived and do not need backing up. Redis is not authoritative: losing it delays jobs until the
reconciler re-announces them from PostgreSQL.

## Targets

These are targets to validate, not guarantees:

- **RPO:** 1 hour for database and objects (continuous WAL and versioning reduce this).
- **RTO:** 4 hours for a single-region restore.
- Backups are encrypted at rest and access is limited to the operations role.

## Manual backup

```bash
DATABASE_URL='postgresql://...' S3_BUCKET='parsepilot-documents' \
  ./scripts/backup.sh /secure/backups/parsepilot
```

This writes a compressed custom-format dump, mirrors objects and writes a SHA-256 checksum. For AWS, configure the
`aws` CLI instead of `mc`; the script detects either. Copy backups off-host immediately.

## Restore procedure

1. Declare an incident and freeze writes (put the app in maintenance mode at the proxy).
2. Provision a clean PostgreSQL instance. Never restore over the live database.
3. Restore the dump:
   ```bash
   createdb parsepilot_restore
   pg_restore --clean --if-exists --no-owner --no-privileges \
     -d postgresql://.../parsepilot_restore /secure/backups/postgres-<stamp>.dump
   ```
4. Restore objects into a new bucket, then point `S3_BUCKET` at it after verification.
5. Run `prisma migrate deploy` only if the restored schema predates the current migration set; prefer restoring a dump
   taken with the same release.
6. Verify row counts and a sample of documents:
   ```sql
   SELECT count(*) FROM "Document" WHERE "deletedAt" IS NULL;
   SELECT count(*) FROM "ProcessingJob" WHERE status = 'queued';
   ```
7. Start one web instance and one worker against the restored database with the queue paused. Sign in, download a
   document, confirm signed URLs work.
8. Resume traffic and re-enable workers. Reconcile queued jobs (scheduler or `POST /api/v1/internal/jobs/reconcile`).

## Deletion and backups

User deletion removes live rows and objects. Backups may retain deleted data until rotation completes. Do not restore
a backup to satisfy an access request. If a restore reintroduces deleted data, re-run account/workspace deletion and
the retention sweep immediately and document it in the incident record.

## Quarterly restore drill

- Restore the latest backup into an isolated environment.
- Verify migrations, sign-in, document download, export generation and a full job lifecycle.
- Record the time taken and any gaps; update this runbook.
- Never use production credentials for the drill.
