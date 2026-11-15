#!/usr/bin/env bash
# Backs up PostgreSQL and the object-storage bucket.
#
# Usage:
#   DATABASE_URL=postgresql://... S3_BUCKET=parsepilot-documents ./scripts/backup.sh /backups/parsepilot
#
# For MinIO, set S3_ENDPOINT and MC alias credentials. For AWS S3, use `aws s3 sync`
# instead of `mc mirror`. Backups contain personal data: encrypt at rest and
# restrict access. Test restores quarterly (docs/backup-recovery.md).
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: DATABASE_URL=... S3_BUCKET=... $0 <backup-directory>" >&2
  exit 2
fi

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

DEST="$1"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"

echo "==> dumping PostgreSQL (custom format, compressed)"
pg_dump --format=custom --compress=9 --no-owner --no-privileges "$DATABASE_URL" >"$DEST/postgres-$STAMP.dump"

echo "==> mirroring object storage"
if command -v mc >/dev/null 2>&1; then
  mc mirror --overwrite --preserve "local/$S3_BUCKET" "$DEST/objects/$STAMP"
elif command -v aws >/dev/null 2>&1; then
  aws s3 sync "s3://$S3_BUCKET" "$DEST/objects/$STAMP" --only-show-errors
else
  echo "Install 'mc' (MinIO) or 'aws' to back up objects." >&2
  exit 3
fi

echo "==> checksums"
sha256sum "$DEST/postgres-$STAMP.dump" >"$DEST/postgres-$STAMP.sha256"

echo "Backup complete: $DEST/postgres-$STAMP.dump"
echo "Verify with: pg_restore --list '$DEST/postgres-$STAMP.dump' | head"
