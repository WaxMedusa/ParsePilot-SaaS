import { z } from 'zod';

/**
 * Environment access.
 *
 * Values are read lazily so that a production build does not require every
 * runtime secret, while `assertServerConfig()` fails fast at boot (or on
 * /ready) if a production deployment is missing critical configuration.
 */

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigurationError(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback = ''): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function boolEnv(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return z.enum(['true', 'false', '1', '0']).safeParse(raw).data === 'true' || raw === '1';
}

function deploymentUrl(): string | undefined {
  const host = optionalEnv('VERCEL_PROJECT_PRODUCTION_URL', optionalEnv('VERCEL_URL'));
  return host ? `https://${host}` : undefined;
}

export const appUrl = optionalEnv(
  'APP_URL',
  optionalEnv('NEXT_PUBLIC_APP_URL', deploymentUrl() ?? 'http://localhost:3000'),
).replace(/\/$/, '');

export const appConfig = {
  appUrl,
  maxUploadBytes: intEnv('MAX_UPLOAD_MB', 25) * 1024 * 1024,
  allowedMimeTypes: optionalEnv('ALLOWED_MIME_TYPES', 'application/pdf,image/png,image/jpeg,image/tiff,image/webp')
    .split(',')
    .map((mime) => mime.trim())
    .filter(Boolean),
  processorUrl: optionalEnv('PROCESSOR_URL', 'http://localhost:8000').replace(/\/$/, ''),
  processorTimeoutMs: intEnv('PROCESSOR_TIMEOUT_MS', 10_000),
  queueName: optionalEnv('QUEUE_NAME', 'parsepilot:jobs'),
  storageDriver: (optionalEnv('STORAGE_DRIVER', 'local') === 's3' ? 's3' : 'local') as 's3' | 'local',
  storageLocalRoot: optionalEnv('STORAGE_LOCAL_ROOT', './storage-data'),
  s3: {
    endpoint: optionalEnv('S3_ENDPOINT'),
    region: optionalEnv('S3_REGION', 'us-east-1'),
    bucket: optionalEnv('S3_BUCKET', 'parsepilot-documents'),
    accessKeyId: optionalEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: optionalEnv('S3_SECRET_ACCESS_KEY'),
    forcePathStyle: boolEnv('S3_FORCE_PATH_STYLE', true),
  },
  stripe: {
    secretKey: optionalEnv('STRIPE_SECRET_KEY'),
    webhookSecret: optionalEnv('STRIPE_WEBHOOK_SECRET'),
  },
  logLevel: optionalEnv('LOG_LEVEL', isProduction ? 'info' : 'debug'),
};

// A development-only secret keeps local work frictionless. It is rejected in
// production by assertServerConfig(), which requires real 32-byte secrets.
const DEV_SECRET = 'parsepilot-development-only-secret-do-not-use-in-production';

export function sessionSecret(): string {
  return optionalEnv('SESSION_SECRET', isTest ? 'test-session-secret' : DEV_SECRET);
}

export function downloadSigningSecret(): string {
  return optionalEnv('DOWNLOAD_SIGNING_SECRET', isTest ? 'test-download-secret' : DEV_SECRET);
}

export function internalServiceToken(): string {
  return optionalEnv('INTERNAL_SERVICE_TOKEN', isTest ? 'test-internal-token' : DEV_SECRET);
}

export function databaseUrl(): string {
  return optionalEnv('DATABASE_URL', 'postgresql://parsepilot:parsepilot@localhost:5432/parsepilot?schema=public');
}

export function redisUrl(): string {
  return optionalEnv('REDIS_URL');
}

export type ConfigProblem = { key: string; message: string };

/** Verifies that the deployment has the configuration it needs. */
export function collectConfigProblems(): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const requireSecret = (name: string, value: string) => {
    if (!value || value === DEV_SECRET) {
      problems.push({ key: name, message: `${name} must be set to a unique random secret (openssl rand -hex 32)` });
    } else if (value.length < 32) {
      problems.push({ key: name, message: `${name} must be at least 32 characters` });
    }
  };

  if (isProduction) {
    if (!process.env.DATABASE_URL) problems.push({ key: 'DATABASE_URL', message: 'DATABASE_URL is required' });
    if (!process.env.REDIS_URL) problems.push({ key: 'REDIS_URL', message: 'REDIS_URL is required for background processing' });
    requireSecret('SESSION_SECRET', optionalEnv('SESSION_SECRET'));
    requireSecret('DOWNLOAD_SIGNING_SECRET', optionalEnv('DOWNLOAD_SIGNING_SECRET'));
    requireSecret('INTERNAL_SERVICE_TOKEN', optionalEnv('INTERNAL_SERVICE_TOKEN'));
    if (appConfig.storageDriver !== 's3') {
      problems.push({ key: 'STORAGE_DRIVER', message: 'Production requires private object storage (STORAGE_DRIVER=s3)' });
    }
    if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      problems.push({ key: 'S3_*', message: 'S3 bucket credentials are required in production' });
    }
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      problems.push({ key: 'STRIPE_*', message: 'Stripe secret key and webhook secret are required for billing' });
    }
    if (!process.env.APP_URL) problems.push({ key: 'APP_URL', message: 'APP_URL is required to build absolute links' });
  }

  if (appConfig.storageDriver === 's3' && (!appConfig.s3.bucket || !appConfig.s3.accessKeyId)) {
    problems.push({ key: 'S3_*', message: 'STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY' });
  }

  return problems;
}
