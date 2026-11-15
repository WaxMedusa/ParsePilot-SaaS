import { mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import { appUrl, isProduction, appConfig } from '../env';
import { signFilePayload } from './signing';
import type { StorageProvider, StoragePutOptions } from './types';
import { StorageError } from './types';

/**
 * Development storage. Objects live outside the web root (STORAGE_LOCAL_ROOT)
 * and are only ever served through the signed file route — they are not
 * statically reachable. Production must use S3-compatible private storage.
 */
export class LocalStorage implements StorageProvider {
  readonly driver = 'local' as const;
  private readonly root: string;

  constructor(root = appConfig.storageLocalRoot) {
    if (isProduction) {
      throw new StorageError('LocalStorage must not be used in production; configure STORAGE_DRIVER=s3');
    }
    this.root = normalize(root);
  }

  private resolve(key: string): string {
    if (!key || key.includes('\0')) throw new StorageError('Invalid storage key');
    const full = normalize(join(this.root, key));
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new StorageError('Storage key escapes the storage root');
    }
    return full;
  }

  async putObject(key: string, body: Uint8Array, _options: StoragePutOptions): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { mode: 0o600 });
  }

  async getObject(key: string): Promise<Uint8Array> {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch (error) {
      throw new StorageError('Object not found', error);
    }
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async createDownloadUrl(key: string, expiresInSeconds: number, filename?: string): Promise<string> {
    const token = signFilePayload({
      key,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      name: filename,
      disposition: 'attachment',
    });
    return `${appUrl}/api/v1/files/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`;
  }

  async createUploadUrl(key: string, _contentType: string, expiresInSeconds: number): Promise<string> {
    const token = signFilePayload({ key, exp: Math.floor(Date.now() / 1000) + expiresInSeconds, disposition: 'attachment' });
    return `${appUrl}/api/v1/files/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}&mode=upload`;
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      await mkdir(dirname(join(this.root, 'health', 'probe')), { recursive: true });
      const probe = join(this.root, 'health', 'probe');
      await writeFile(probe, 'ok', { mode: 0o600 });
      await rm(probe, { force: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'unknown' };
    }
  }
}
