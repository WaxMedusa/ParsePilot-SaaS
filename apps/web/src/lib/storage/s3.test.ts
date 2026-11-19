import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * Presigning contract for S3 storage.
 *
 * AWS S3 is reached virtual-hosted-style, while S3-compatible providers
 * (MinIO, R2, B2) are reached path-style through S3_ENDPOINT; picking the wrong
 * one produces a request that signs fine and fails at the provider. A presigned
 * URL must also carry no SDK-injected checksum parameter, because the browser
 * and the export worker cannot reproduce that checksum when they PUT. And the
 * SSE header is signed only when the deployment configured one, which is why
 * the upload-target route echoes the same header back to the caller.
 */

const TOUCHED = ['S3_ENDPOINT', 'S3_FORCE_PATH_STYLE', 'S3_SERVER_SIDE_ENCRYPTION'] as const;
const ORIGINAL_ENV = { ...process.env };

const BASE_ENV: Record<string, string> = {
  OBJECT_STORAGE_DRIVER: 's3',
  S3_BUCKET: 'parsepilot-documents-prod',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'AKIAEXAMPLE000000000',
  S3_SECRET_ACCESS_KEY: 'example-secret-not-real',
};

/** Re-imports the config and driver so each case sees only its own variables. */
async function loadStorage(extra: Record<string, string>) {
  vi.resetModules();
  for (const key of TOUCHED) delete process.env[key];
  Object.assign(process.env, BASE_ENV, extra);
  const { appConfig } = await import('../env');
  const { S3Storage } = await import('./s3');
  return { appConfig, storage: new S3Storage() };
}

function signedHeaders(url: URL): string[] {
  const signed = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
  return signed.split(';').map((header) => header.toLowerCase());
}

function queryParameterNames(url: URL): string[] {
  return [...url.searchParams.keys()].map((name) => name.toLowerCase());
}

afterAll(() => {
  for (const key of TOUCHED) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe('S3 presigning', () => {
  it('addresses AWS virtual-hosted-style with no endpoint configured', async () => {
    const { appConfig, storage } = await loadStorage({});

    expect(appConfig.s3.forcePathStyle).toBe(false);
    expect(appConfig.s3.serverSideEncryption).toBeUndefined();

    const url = new URL(await storage.createUploadUrl('workspaces/ws/doc.pdf', 'application/pdf', 300));
    expect(url.host).toBe('parsepilot-documents-prod.s3.us-east-1.amazonaws.com');
    expect(url.pathname).toBe('/workspaces/ws/doc.pdf');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
  });

  it('never signs a checksum parameter into a presigned upload', async () => {
    const { storage } = await loadStorage({});
    const url = new URL(await storage.createUploadUrl('workspaces/ws/doc.pdf', 'application/pdf', 300));

    const names = queryParameterNames(url);
    expect(names.filter((name) => name.includes('checksum'))).toEqual([]);
    expect(names).not.toContain('x-amz-sdk-checksum-algorithm');
  });

  it('addresses a custom endpoint path-style and signs SSE only when configured', async () => {
    const { appConfig, storage } = await loadStorage({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_SERVER_SIDE_ENCRYPTION: 'AES256',
    });

    expect(appConfig.s3.forcePathStyle).toBe(true);
    expect(appConfig.s3.serverSideEncryption).toBe('AES256');

    const url = new URL(await storage.createUploadUrl('workspaces/ws/doc.pdf', 'application/pdf', 300));
    expect(url.host).toBe('localhost:9000');
    expect(url.pathname.startsWith('/parsepilot-documents-prod/')).toBe(true);
    expect(signedHeaders(url)).toContain('x-amz-server-side-encryption');
    // A shared bucket host must not reach AWS through a different region.
    expect(queryParameterNames(url).filter((name) => name.includes('checksum'))).toEqual([]);
  });

  it('leaves the SSE header unsigned when the bucket owns encryption', async () => {
    const { storage } = await loadStorage({});
    const url = new URL(await storage.createUploadUrl('workspaces/ws/doc.pdf', 'application/pdf', 300));

    expect(signedHeaders(url)).not.toContain('x-amz-server-side-encryption');
  });

  it('honours an explicit path-style override on AWS', async () => {
    const { appConfig } = await loadStorage({ S3_FORCE_PATH_STYLE: 'true' });
    expect(appConfig.s3.forcePathStyle).toBe(true);
  });
});
