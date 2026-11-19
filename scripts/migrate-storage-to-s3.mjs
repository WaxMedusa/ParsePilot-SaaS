#!/usr/bin/env node
/**
 * Copies every object from the Supabase Storage bucket to Amazon S3 (or any
 * S3-compatible) bucket, keeping object keys identical so existing
 * Document.storageKey, Export.storageKey and User.avatarKey rows keep
 * resolving without a database migration.
 *
 * Dry run (lists and compares, writes nothing):
 *   node --env-file=apps/web/.env scripts/migrate-storage-to-s3.mjs
 *
 * Copy, then verify every object by reading it back and comparing sha256:
 *   node --env-file=apps/web/.env scripts/migrate-storage-to-s3.mjs --apply
 *
 * Copy, verify, and only then remove the source objects:
 *   node --env-file=apps/web/.env scripts/migrate-storage-to-s3.mjs --apply --delete-source
 *
 * Flags:
 *   --apply          write objects into the target bucket (default: list only)
 *   --delete-source  delete each source object after its copy is verified
 *   --no-verify      skip the read-back sha256 comparison (size check still runs)
 *   --overwrite      re-upload objects that already exist in the target
 *
 * Required environment (source):
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 *   SUPABASE_STORAGE_BUCKET (default: parsepilot-documents)
 *
 * Required environment (target):
 *   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 * Optional environment (target):
 *   S3_REGION (default: us-east-1 on AWS) and S3_ENDPOINT (omit for AWS S3,
 *   set it for MinIO/R2/B2). S3_FORCE_PATH_STYLE defaults to false for AWS and
 *   true when an endpoint is set. S3_SERVER_SIDE_ENCRYPTION=AES256 is applied
 *   to uploaded objects, matching what the web app signs.
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const deleteSource = args.has('--delete-source');
const verify = !args.has('--no-verify');
const overwrite = args.has('--overwrite');

// Convenience: pick up apps/web/.env so `npm run storage:migrate` works without
// exporting variables by hand. Real environment variables still win.
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('apps/web/.env');
  } catch {
    // No local env file; fall back to exported variables.
  }
}

const env = process.env;

const source = {
  url: (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''),
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  bucket: env.SUPABASE_STORAGE_BUCKET ?? 'parsepilot-documents',
};

const target = {
  endpoint: env.S3_ENDPOINT ?? '',
  region: env.S3_REGION ?? (env.S3_ENDPOINT ? 'auto' : 'us-east-1'),
  bucket: env.S3_BUCKET ?? 'parsepilot-documents',
  accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
  secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
  forcePathStyle: env.S3_FORCE_PATH_STYLE
    ? env.S3_FORCE_PATH_STYLE !== 'false'
    : Boolean(env.S3_ENDPOINT),
  serverSideEncryption: env.S3_SERVER_SIDE_ENCRYPTION === 'AES256' ? 'AES256' : undefined,
};

const MISSING_SOURCE = [
  ['SUPABASE_URL', source.url],
  ['SUPABASE_SERVICE_ROLE_KEY', source.serviceRoleKey],
].filter(([, value]) => !value).map(([name]) => name);

const MISSING_TARGET = [
  ['S3_BUCKET', target.bucket],
  ['S3_ACCESS_KEY_ID', target.accessKeyId],
  ['S3_SECRET_ACCESS_KEY', target.secretAccessKey],
].filter(([, value]) => !value).map(([name]) => name);

if (MISSING_SOURCE.length || MISSING_TARGET.length) {
  console.error('Missing environment variables:');
  for (const name of [...MISSING_SOURCE, ...MISSING_TARGET]) console.error(`  - ${name}`);
  console.error('\nPass them with --env-file, or export them in the shell running this script.');
  process.exit(2);
}

const supabase = createClient(source.url, source.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const from = supabase.storage.from(source.bucket);

const s3 = new S3Client({
  region: target.region,
  endpoint: target.endpoint || undefined,
  forcePathStyle: target.forcePathStyle,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: target.accessKeyId,
    secretAccessKey: target.secretAccessKey,
  },
});

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Walks the bucket recursively; Supabase marks folders with a null id. */
async function listObjects(prefix = '') {
  const pageSize = 1000;
  const found = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await from.list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`Listing "${prefix || '/'}" failed: ${error.message}`);
    if (!data?.length) break;

    for (const entry of data) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null && !entry.metadata) {
        found.push(...(await listObjects(key)));
        continue;
      }
      found.push({
        key,
        size: Number(entry.metadata?.size ?? 0),
        contentType: entry.metadata?.mimetype || 'application/octet-stream',
      });
    }
    if (data.length < pageSize) break;
  }
  return found;
}

async function headTarget(key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: target.bucket, Key: key }));
    return { exists: true, size: Number(head.ContentLength ?? 0) };
  } catch (error) {
    const name = error?.name ?? '';
    if (name === 'NotFound' || name === 'NoSuchKey' || name === 'NotFoundError') return { exists: false, size: 0 };
    throw error;
  }
}

async function readTarget(key) {
  const object = await s3.send(new GetObjectCommand({ Bucket: target.bucket, Key: key }));
  return Buffer.from(await object.Body.transformToByteArray());
}

async function main() {
  console.log(`Source: supabase:${source.bucket} (${source.url})`);
  console.log(`Target: s3:${target.bucket} (${target.endpoint || `aws ${target.region}`})`);
  console.log(apply ? 'Mode: APPLY' : 'Mode: DRY RUN (pass --apply to copy)');
  console.log('');

  const objects = await listObjects();
  const totalBytes = objects.reduce((sum, object) => sum + object.size, 0);
  console.log(`${objects.length} object(s), ${formatBytes(totalBytes)} total.\n`);

  if (!objects.length) return { copied: 0, skipped: 0, failed: 0 };

  let copied = 0;
  let skipped = 0;
  let deleted = 0;
  const failures = [];

  for (const [index, object] of objects.entries()) {
    const position = `[${index + 1}/${objects.length}]`;
    try {
      const existing = await headTarget(object.key);
      if (existing.exists && !overwrite) {
        if (existing.size !== object.size) {
          failures.push({ key: object.key, reason: `target size ${existing.size} != source ${object.size}` });
          console.log(`${position} MISMATCH ${object.key} (target exists with a different size; rerun with --overwrite)`);
        } else {
          skipped += 1;
          console.log(`${position} skip   ${object.key}`);
        }
        continue;
      }

      if (!apply) {
        console.log(`${position} would copy ${object.key} (${formatBytes(object.size)})`);
        continue;
      }

      const { data, error } = await from.download(object.key);
      if (error || !data) throw new Error(error?.message ?? 'download returned no body');
      const body = Buffer.from(await data.arrayBuffer());

      await s3.send(
        new PutObjectCommand({
          Bucket: target.bucket,
          Key: object.key,
          Body: body,
          ContentType: object.contentType,
          ServerSideEncryption: target.serverSideEncryption,
        }),
      );

      if (verify) {
        const roundTrip = await readTarget(object.key);
        const sourceHash = sha256(body);
        const targetHash = sha256(roundTrip);
        if (sourceHash !== targetHash) {
          throw new Error(`hash mismatch after upload (${sourceHash} != ${targetHash})`);
        }
      }

      copied += 1;
      console.log(`${position} copied ${object.key} (${formatBytes(body.length)})${verify ? ' ✓ verified' : ''}`);

      if (deleteSource) {
        const { error: removeError } = await from.remove([object.key]);
        if (removeError) throw new Error(`source delete failed: ${removeError.message}`);
        deleted += 1;
      }
    } catch (error) {
      failures.push({ key: object.key, reason: error?.message ?? String(error) });
      console.log(`${position} FAILED ${object.key}: ${error?.message ?? error}`);
    }
  }

  console.log('');
  console.log(`copied: ${copied}  skipped: ${skipped}  deleted from source: ${deleted}  failed: ${failures.length}`);
  if (!apply) console.log('Nothing was written. Rerun with --apply to copy.');

  if (failures.length) {
    console.error('\nFailures:');
    for (const failure of failures) console.error(`  - ${failure.key}: ${failure.reason}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
