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
  // Preview links must stay on the preview deployment; otherwise invitation
  // and password-reset emails point at production.
  const preview = optionalEnv('VERCEL_ENV') === 'preview';
  const host = preview
    ? optionalEnv('VERCEL_URL', optionalEnv('VERCEL_PROJECT_PRODUCTION_URL'))
    : optionalEnv('VERCEL_PROJECT_PRODUCTION_URL', optionalEnv('VERCEL_URL'));
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
  queueDriver: (optionalEnv('QUEUE_DRIVER', optionalEnv('REDIS_URL') ? 'redis' : 'database') === 'redis'
    ? 'redis'
    : 'database') as 'redis' | 'database',
  workerPollIntervalSeconds: intEnv('PROCESSOR_POLL_INTERVAL_SECONDS', 5),
  storageDriver: (() => {
    // OBJECT_STORAGE_DRIVER is preferred on Vercel because Buildah reserves
    // STORAGE_DRIVER for its container-storage driver and rejects app values.
    const driver = optionalEnv('OBJECT_STORAGE_DRIVER', optionalEnv('STORAGE_DRIVER', 'local'));
    return (driver === 's3' || driver === 'supabase' ? driver : 'local') as 's3' | 'supabase' | 'local';
  })(),
  storageLocalRoot: optionalEnv('STORAGE_LOCAL_ROOT', './storage-data'),
  s3: {
    endpoint: optionalEnv('S3_ENDPOINT'),
    region: optionalEnv('S3_REGION', 'us-east-1'),
    bucket: optionalEnv('S3_BUCKET', 'parsepilot-documents'),
    accessKeyId: optionalEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: optionalEnv('S3_SECRET_ACCESS_KEY'),
    forcePathStyle: boolEnv('S3_FORCE_PATH_STYLE', true),
    // SSE-S3 (x-amz-server-side-encryption: AES256) is an AWS-native header.
    // Cloudflare R2 and Backblaze B2 encrypt at rest by default and reject it,
    // so the header is opt-in rather than the default.
    serverSideEncryption: (optionalEnv('S3_SERVER_SIDE_ENCRYPTION') === 'AES256' ? 'AES256' : undefined) as
      | 'AES256'
      | undefined,
  },
  googleDrive: {
    // Optional. Without both values the Google Drive connection stays hidden
    // and every document keeps using the deployment's own storage.
    clientId: optionalEnv('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: optionalEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    folderName: optionalEnv('GOOGLE_DRIVE_FOLDER_NAME', 'ParsePilot'),
    redirectUri: optionalEnv('GOOGLE_OAUTH_REDIRECT_URI', `${appUrl}/api/v1/integrations/google-drive/callback`),
  },
  supabaseStorage: {
    url: optionalEnv('SUPABASE_URL', optionalEnv('NEXT_PUBLIC_SUPABASE_URL')),
    serviceRoleKey: optionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
    bucket: optionalEnv('SUPABASE_STORAGE_BUCKET', 'parsepilot-documents'),
  },
  stripe: {
    secretKey: optionalEnv('STRIPE_SECRET_KEY'),
    webhookSecret: optionalEnv('STRIPE_WEBHOOK_SECRET'),
  },
  email: {
    provider: optionalEnv('EMAIL_PROVIDER').toLowerCase(),
    from: optionalEnv('EMAIL_FROM'),
    replyTo: optionalEnv('EMAIL_REPLY_TO'),
    resendApiKey: optionalEnv('RESEND_API_KEY'),
    postmarkToken: optionalEnv('POSTMARK_SERVER_TOKEN'),
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
    if (appConfig.queueDriver === 'redis' && !process.env.REDIS_URL) {
      problems.push({ key: 'REDIS_URL', message: 'REDIS_URL is required when QUEUE_DRIVER=redis' });
    }
    if (appConfig.queueDriver === 'redis' && !process.env.PROCESSOR_URL) {
      problems.push({ key: 'PROCESSOR_URL', message: 'PROCESSOR_URL is required when QUEUE_DRIVER=redis' });
    }
    requireSecret('SESSION_SECRET', optionalEnv('SESSION_SECRET'));
    requireSecret('DOWNLOAD_SIGNING_SECRET', optionalEnv('DOWNLOAD_SIGNING_SECRET'));
    requireSecret('INTERNAL_SERVICE_TOKEN', optionalEnv('INTERNAL_SERVICE_TOKEN'));
    if (appConfig.storageDriver === 'local') {
      problems.push({ key: 'OBJECT_STORAGE_DRIVER', message: 'Production requires private object storage (OBJECT_STORAGE_DRIVER=s3 or supabase)' });
    }
    if (appConfig.storageDriver === 's3' && (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY)) {
      problems.push({ key: 'S3_*', message: 'S3 bucket credentials are required when STORAGE_DRIVER=s3' });
    }
    if (appConfig.storageDriver === 'supabase' && (!appConfig.supabaseStorage.url || !appConfig.supabaseStorage.serviceRoleKey || !appConfig.supabaseStorage.bucket)) {
      problems.push({ key: 'SUPABASE_STORAGE_*', message: 'Supabase Storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET' });
    }
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      problems.push({ key: 'STRIPE_*', message: 'Stripe secret key and webhook secret are required for billing' });
    }
    if (!process.env.APP_URL) problems.push({ key: 'APP_URL', message: 'APP_URL is required to build absolute links' });
    if (appConfig.email.provider && !['resend', 'postmark', 'none'].includes(appConfig.email.provider)) {
      problems.push({ key: 'EMAIL_PROVIDER', message: 'EMAIL_PROVIDER must be resend, postmark or none' });
    }
    if (appConfig.email.provider === 'resend' && (!appConfig.email.resendApiKey || !appConfig.email.from)) {
      problems.push({ key: 'EMAIL_*', message: 'RESEND_API_KEY and EMAIL_FROM are required when EMAIL_PROVIDER=resend' });
    }
    if (appConfig.email.provider === 'postmark' && (!appConfig.email.postmarkToken || !appConfig.email.from)) {
      problems.push({ key: 'EMAIL_*', message: 'POSTMARK_SERVER_TOKEN and EMAIL_FROM are required when EMAIL_PROVIDER=postmark' });
    }
  }

  if (appConfig.storageDriver === 's3' && (!appConfig.s3.bucket || !appConfig.s3.accessKeyId)) {
    problems.push({ key: 'S3_*', message: 'STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY' });
  }
  if (appConfig.storageDriver === 'supabase' && (!appConfig.supabaseStorage.url || !appConfig.supabaseStorage.serviceRoleKey)) {
    problems.push({ key: 'SUPABASE_STORAGE_*', message: 'STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });
  }

  return problems;
}
