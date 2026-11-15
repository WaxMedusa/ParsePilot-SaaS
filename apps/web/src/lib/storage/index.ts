import { appConfig } from '../env';
import { LocalStorage } from './local';
import { S3Storage } from './s3';
import type { StorageProvider } from './types';

export type { StorageProvider } from './types';
export { StorageError } from './types';

const globalForStorage = globalThis as unknown as { __parsepilotStorage?: StorageProvider };

export function getStorage(): StorageProvider {
  if (!globalForStorage.__parsepilotStorage) {
    globalForStorage.__parsepilotStorage = appConfig.storageDriver === 's3' ? new S3Storage() : new LocalStorage();
  }
  return globalForStorage.__parsepilotStorage;
}

/** Generates an unguessable object key that never embeds the original filename. */
export function generateStorageKey(workspaceId: string, extension: string): string {
  const id = crypto.randomUUID().replace(/-/g, '');
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const day = new Date().toISOString().slice(0, 10);
  return `workspaces/${workspaceId}/${day}/${id}.${safeExt}`;
}
