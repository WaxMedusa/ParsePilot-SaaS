-- Google Drive storage was removed: documents always live in the deployment's
-- configured object storage. Links stored in this table could never contain a
-- document on this deployment because no OAuth client was configured.
DROP TABLE IF EXISTS "StorageConnection";
