/**
 * Storage layer contract. Object keys are random, generated server-side; the
 * original filename is metadata only and never used as an identifier.
 */

export type StoragePutOptions = {
  contentType: string;
  /** sha256 of the payload, verified again after upload. */
  checksumSha256?: string;
};

export interface StorageProvider {
  readonly driver: 'local' | 's3' | 'supabase' | 'google-drive';
  putObject(key: string, body: Uint8Array, options: StoragePutOptions): Promise<void>;
  getObject(key: string): Promise<Uint8Array>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  /** Creates a short-lived signed URL for private download. */
  createDownloadUrl(key: string, expiresInSeconds: number, filename?: string, contentType?: string): Promise<string>;
  /** Creates a short-lived signed URL that a worker can upload an artefact to. */
  createUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
  healthCheck(): Promise<{ ok: boolean; error?: string }>;
}

export class StorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}
