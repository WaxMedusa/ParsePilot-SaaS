import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from '../env';
import type { StorageProvider, StoragePutOptions } from './types';
import { StorageError } from './types';

/**
 * Private Supabase Storage. The service-role key is server-only and bypasses
 * RLS; no caller ever receives it, and objects are only reached through
 * short-lived signed URLs minted after an authorization check.
 */
export class SupabaseStorage implements StorageProvider {
  readonly driver = 'supabase' as const;
  private client: SupabaseClient | null = null;
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;

  constructor() {
    this.url = appConfig.supabaseStorage.url.replace(/\/$/, '');
    this.serviceRoleKey = appConfig.supabaseStorage.serviceRoleKey;
    this.bucket = appConfig.supabaseStorage.bucket;
    if (!this.url || !this.serviceRoleKey || !this.bucket) {
      throw new StorageError('Supabase Storage is selected but configuration is incomplete');
    }
  }

  private storage() {
    if (!this.client) {
      this.client = createClient(this.url, this.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client.storage.from(this.bucket);
  }

  private absoluteUrl(signedUrl: string): string {
    return signedUrl.startsWith('http') ? signedUrl : `${this.url}${signedUrl.startsWith('/') ? '' : '/'}${signedUrl}`;
  }

  async putObject(key: string, body: Uint8Array, options: StoragePutOptions): Promise<void> {
    const { error } = await this.storage().upload(key, Buffer.from(body), {
      contentType: options.contentType,
      upsert: false,
    });
    if (error) throw new StorageError('Failed to store object', error);
  }

  async getObject(key: string): Promise<Uint8Array> {
    const { data, error } = await this.storage().download(key);
    if (error || !data) throw new StorageError('Failed to read object', error);
    return new Uint8Array(await data.arrayBuffer());
  }

  async deleteObject(key: string): Promise<void> {
    const { error } = await this.storage().remove([key]);
    if (error) throw new StorageError('Failed to delete object', error);
  }

  async objectExists(key: string): Promise<boolean> {
    const slash = key.lastIndexOf('/');
    const prefix = slash >= 0 ? key.slice(0, slash) : '';
    const name = slash >= 0 ? key.slice(slash + 1) : key;
    const { data, error } = await this.storage().list(prefix, { search: name, limit: 100 });
    if (error) throw new StorageError('Failed to inspect object', error);
    return Boolean(data?.some((entry) => entry.name === name));
  }

  async createDownloadUrl(key: string, expiresInSeconds: number, filename?: string): Promise<string> {
    const { data, error } = await this.storage().createSignedUrl(
      key,
      Math.max(30, Math.min(expiresInSeconds, 3600)),
      filename ? { download: filename } : undefined,
    );
    if (error || !data?.signedUrl) throw new StorageError('Failed to create download URL', error);
    return this.absoluteUrl(data.signedUrl);
  }

  async createUploadUrl(key: string, _contentType: string, _expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.storage().createSignedUploadUrl(key);
    if (error || !data?.signedUrl) throw new StorageError('Failed to create upload URL', error);
    return this.absoluteUrl(data.signedUrl);
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await this.storage().list('', { limit: 1 });
      if (error) return { ok: false, error: error.name || 'storage_error' };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.name : 'unknown' };
    }
  }
}
