import { prisma } from '../prisma';
import { getStorage } from './index';
import { parseDriveKey } from './google-drive';
import type { StorageProvider } from './types';

/**
 * Storage routing and shared-object safety.
 *
 * Two documents can share one object after a checksum dedupe, so deleting a
 * document must only remove the bytes when nothing else still points at them.
 */

/** Resolves the driver that owns an object key, without a session. */
export async function getStorageForKey(key: string): Promise<StorageProvider> {
  const drive = parseDriveKey(key);
  if (!drive) return getStorage();
  const { GoogleDriveStorage } = await import('./google-drive');
  return new GoogleDriveStorage(drive.userId);
}

export type UnreferencedDeleteResult = { deleted: boolean; shared: boolean };

/**
 * Deletes an object only when no document row still references its key.
 * `excludingDocumentId` skips the row that is being removed right now.
 */
export async function deleteObjectIfUnreferenced(
  storageKey: string,
  options: { excludingDocumentId?: string } = {},
): Promise<UnreferencedDeleteResult> {
  const others = await prisma.document.count({
    where: {
      storageKey,
      ...(options.excludingDocumentId ? { id: { not: options.excludingDocumentId } } : {}),
    },
  });
  if (others > 0) return { deleted: false, shared: true };

  const storage = await getStorageForKey(storageKey);
  await storage.deleteObject(storageKey);
  return { deleted: true, shared: false };
}
