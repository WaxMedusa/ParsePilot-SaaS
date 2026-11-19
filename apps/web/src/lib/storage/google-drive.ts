import { appUrl } from '../env';
import { DRIVE_API, DRIVE_UPLOAD_API, driveAccessToken, ensureDriveFolder } from '../integrations/google-drive';
import { signFilePayload } from './signing';
import { StorageError, type StorageProvider, type StoragePutOptions } from './types';

/**
 * Per-user Google Drive storage.
 *
 * Object keys carry their own routing: `gdrive/<userId>/<fileId>.<ext>`. That
 * keeps reads working from a signed URL with no session, and lets one user's
 * workspace use their own Drive quota while everyone else stays on the
 * deployment's bucket. Files are created inside a single ParsePilot folder and
 * are only ever reachable through this app plus the user's own Drive account.
 */

export type DriveKey = { userId: string; fileId: string; extension: string };

export function parseDriveKey(key: string): DriveKey | null {
  const parts = key.split('/');
  if (parts.length !== 3 || parts[0] !== 'gdrive') return null;
  const [, userId, tail] = parts as [string, string, string];
  if (!userId || !tail) return null;
  const dot = tail.indexOf('.');
  const fileId = dot > 0 ? tail.slice(0, dot) : tail;
  const extension = dot > 0 ? tail.slice(dot + 1) : 'bin';
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return null;
  return { userId, fileId, extension };
}

export function driveStorageKey(userId: string, fileId: string, extension: string): string {
  return `gdrive/${userId}/${fileId}.${extension}`;
}

const MULTIPART_MIME = 'multipart/related';

function multipartBody(metadata: Record<string, unknown>, contentType: string, bytes: Uint8Array) {
  const boundary = `parsepilot${crypto.randomUUID().replace(/-/g, '')}`;
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, contentType: `${MULTIPART_MIME}; boundary=${boundary}` };
}

export class GoogleDriveStorage implements StorageProvider {
  readonly driver = 'google-drive' as const;

  constructor(private readonly userId: string) {}

  /** Fetch with one forced token refresh on 401 (revoked or expired token). */
  private async authorized(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await driveAccessToken(this.userId);
    const response = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (response.status === 401 && retry) {
      const fresh = await driveAccessToken(this.userId, { forceRefresh: true });
      return fetch(url, {
        ...init,
        headers: { ...(init.headers ?? {}), authorization: `Bearer ${fresh}` },
        cache: 'no-store',
      });
    }
    return response;
  }

  private key(key: string): DriveKey {
    const parsed = parseDriveKey(key);
    if (!parsed) throw new StorageError('Not a Google Drive storage key');
    if (parsed.userId !== this.userId) throw new StorageError('Drive key belongs to another account');
    return parsed;
  }

  async putObject(key: string, body: Uint8Array, options: StoragePutOptions): Promise<void> {
    const parsed = this.key(key);
    try {
      const folderId = await ensureDriveFolder(this.userId);
      const { body: payload, contentType } = multipartBody(
        {
          id: parsed.fileId,
          name: `${parsed.fileId}.${parsed.extension}`,
          parents: [folderId],
          mimeType: options.contentType,
        },
        options.contentType,
        body,
      );
      const response = await this.authorized(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: payload,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new StorageError(`Google Drive rejected the upload (${response.status}) ${text.slice(0, 200)}`);
      }
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError('Failed to store object in Google Drive', error);
    }
  }

  async getObject(key: string): Promise<Uint8Array> {
    const parsed = this.key(key);
    const response = await this.authorized(`${DRIVE_API}/files/${encodeURIComponent(parsed.fileId)}?alt=media`);
    if (!response.ok) throw new StorageError(`Google Drive read failed (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async deleteObject(key: string): Promise<void> {
    const parsed = this.key(key);
    const response = await this.authorized(`${DRIVE_API}/files/${encodeURIComponent(parsed.fileId)}`, {
      method: 'DELETE',
    });
    // A file the user removed in Drive is already gone; that is success here.
    if (!response.ok && response.status !== 404) {
      throw new StorageError(`Google Drive delete failed (${response.status})`);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    const parsed = this.key(key);
    const response = await this.authorized(
      `${DRIVE_API}/files/${encodeURIComponent(parsed.fileId)}?fields=id&supportsAllDrives=true`,
    );
    return response.ok;
  }

  /**
   * Drive has no presigned URLs. The signed, short-lived app URL is used
   * instead, so downloads keep the same capability-token guarantees.
   */
  async createDownloadUrl(key: string, expiresInSeconds: number, filename?: string, contentType?: string): Promise<string> {
    const token = signFilePayload({
      key,
      exp: Math.floor(Date.now() / 1000) + Math.max(30, Math.min(expiresInSeconds, 3600)),
      name: filename,
      disposition: 'attachment',
      mime: contentType,
    });
    return `${appUrl}/api/v1/files/${encodeURIComponent(key)}?token=${encodeURIComponent(token)}`;
  }

  async createUploadUrl(): Promise<string> {
    throw new StorageError('Google Drive storage does not support direct uploads');
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await this.authorized(`${DRIVE_API}/about?fields=user`);
      return response.ok ? { ok: true } : { ok: false, error: `drive_${response.status}` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'unknown' };
    }
  }
}
