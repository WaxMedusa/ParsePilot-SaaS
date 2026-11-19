import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma } from '../prisma';
import { appConfig, optionalEnv } from '../env';
import { decryptOptional, encryptOptional, tokenEncryptionAvailable } from './token-box';
import { logger } from '../logger';

/**
 * Optional "store my documents in my own Google Drive" connection.
 *
 * Nothing here is required: without GOOGLE_OAUTH_CLIENT_ID/SECRET the feature
 * stays invisible and every document keeps using the deployment's storage.
 * Tokens are encrypted with the deployment's SETTINGS_ENCRYPTION_KEY and are
 * never sent to the browser.
 */

const AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/** drive.file: only files this app created. openid+email: show which account. */
export const DRIVE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'] as const;

const STATE_TTL_MS = 10 * 60 * 1000;

export type DriveStatus = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  folderName: string;
  encryptionAvailable: boolean;
  lastError: string | null;
};

export function driveConfigured(): boolean {
  return Boolean(appConfig.googleDrive.clientId && appConfig.googleDrive.clientSecret);
}

function stateSecret(): string {
  return optionalEnv('DOWNLOAD_SIGNING_SECRET', 'parsepilot-development-only-secret-do-not-use-in-production');
}

function signState(encoded: string): string {
  return createHmac('sha256', `drive-state:${stateSecret()}`).update(encoded).digest('base64url');
}

/** Short-lived, user-bound state token. Google echoes it back on the callback. */
export function createOAuthState(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, n: randomUUID(), exp: Math.floor((Date.now() + STATE_TTL_MS) / 1000) }),
  ).toString('base64url');
  return `${payload}.${signState(payload)}`;
}

export function verifyOAuthState(state: string): { userId: string } | null {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return null;
  const expected = Buffer.from(signState(encoded));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      u?: string;
      exp?: number;
    };
    if (!payload.u || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return { userId: payload.u };
  } catch {
    return null;
  }
}

export function driveAuthorizeUrl(userId: string): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set('client_id', appConfig.googleDrive.clientId);
  url.searchParams.set('redirect_uri', appConfig.googleDrive.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', DRIVE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  // Consent is forced so a re-connect always returns a refresh token.
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', createOAuthState(userId));
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      client_id: appConfig.googleDrive.clientId,
      client_secret: appConfig.googleDrive.clientSecret,
      ...params,
    }).toString(),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || 'Google rejected the token request');
  }
  return payload;
}

async function accountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

/** Completes the OAuth handshake and stores an encrypted refresh token. */
export async function completeDriveConnection(input: { userId: string; code: string }): Promise<{ accountEmail: string | null }> {
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: appConfig.googleDrive.redirectUri,
  });
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Remove ParsePilot from your Google account and connect again.');
  }

  const email = await accountEmail(tokens.access_token);
  const expiresAt = new Date(Date.now() + Math.max(60, (tokens.expires_in ?? 3600) - 60) * 1000);

  await prisma.storageConnection.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      provider: 'google-drive',
      accountEmail: email,
      scope: tokens.scope ?? DRIVE_SCOPES.join(' '),
      refreshToken: encryptOptional(tokens.refresh_token, `drive:${input.userId}`),
      accessToken: encryptOptional(tokens.access_token, `drive:${input.userId}`),
      accessTokenExpiresAt: expiresAt,
    },
    update: {
      accountEmail: email,
      scope: tokens.scope ?? DRIVE_SCOPES.join(' '),
      refreshToken: encryptOptional(tokens.refresh_token, `drive:${input.userId}`),
      accessToken: encryptOptional(tokens.access_token, `drive:${input.userId}`),
      accessTokenExpiresAt: expiresAt,
      folderId: null,
      lastError: null,
    },
  });

  logger.info('google_drive_connected', { userId: input.userId });
  return { accountEmail: email };
}

export async function getDriveStatus(userId: string): Promise<DriveStatus> {
  const connection = await prisma.storageConnection.findUnique({
    where: { userId },
    select: { accountEmail: true, lastError: true },
  });
  return {
    configured: driveConfigured(),
    connected: Boolean(connection),
    accountEmail: connection?.accountEmail ?? null,
    folderName: appConfig.googleDrive.folderName,
    encryptionAvailable: tokenEncryptionAvailable(),
    lastError: connection?.lastError ?? null,
  };
}

/** Returns a usable access token, refreshing it when it is about to expire. */
export async function driveAccessToken(userId: string, options: { forceRefresh?: boolean } = {}): Promise<string> {
  const connection = await prisma.storageConnection.findUnique({
    where: { userId },
    select: { refreshToken: true, accessToken: true, accessTokenExpiresAt: true },
  });
  if (!connection) throw new Error('drive_not_connected');

  const stillValid =
    !options.forceRefresh &&
    connection.accessToken &&
    connection.accessTokenExpiresAt &&
    connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000;

  if (stillValid) {
    const token = decryptOptional(connection.accessToken!, `drive:${userId}`);
    if (token) return token;
  }

  const refreshToken = decryptOptional(connection.refreshToken, `drive:${userId}`);
  if (!refreshToken) throw new Error('drive_reconnect_required');

  try {
    const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
    if (!tokens.access_token) throw new Error('Google returned no access token');
    await prisma.storageConnection.update({
      where: { userId },
      data: {
        accessToken: encryptOptional(tokens.access_token, `drive:${userId}`),
        accessTokenExpiresAt: new Date(Date.now() + Math.max(60, (tokens.expires_in ?? 3600) - 60) * 1000),
        lastError: null,
      },
    });
    return tokens.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'token_refresh_failed';
    await prisma.storageConnection
      .update({ where: { userId }, data: { lastError: message.slice(0, 300) } })
      .catch(() => undefined);
    throw error;
  }
}

type DriveFile = { id?: string; name?: string; mimeType?: string };

/** Creates (once) the ParsePilot folder inside the user's Drive. */
export async function ensureDriveFolder(userId: string): Promise<string> {
  const connection = await prisma.storageConnection.findUnique({
    where: { userId },
    select: { folderId: true },
  });
  if (connection?.folderId) return connection.folderId;

  const token = await driveAccessToken(userId);
  const name = appConfig.googleDrive.folderName.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const search = await fetch(`${DRIVE_API}/files?q=${query}&fields=files(id,name)&spaces=drive&pageSize=1`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (search.ok) {
    const payload = (await search.json()) as { files?: DriveFile[] };
    const existing = payload.files?.[0]?.id;
    if (existing) {
      await prisma.storageConnection.update({ where: { userId }, data: { folderId: existing } });
      return existing;
    }
  }

  const created = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: appConfig.googleDrive.folderName, mimeType: 'application/vnd.google-apps.folder' }),
    cache: 'no-store',
  });
  const payload = (await created.json().catch(() => ({}))) as DriveFile;
  if (!created.ok || !payload.id) throw new Error('drive_folder_create_failed');

  await prisma.storageConnection.update({ where: { userId }, data: { folderId: payload.id } });
  return payload.id;
}

/** Reserves a Drive file id, which doubles as the object key. */
export async function reserveDriveFileId(userId: string): Promise<string> {
  const token = await driveAccessToken(userId);
  const response = await fetch(`${DRIVE_API}/files/generateIds?count=1&space=drive&type=files`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as { ids?: string[] };
  const id = payload.ids?.[0];
  if (!response.ok || !id) throw new Error('drive_id_generate_failed');
  return id;
}

async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }).catch(() => undefined);
}

/**
 * Disconnects Drive after copying anything stored there back to the
 * deployment's own storage. Disconnecting must never strand a document.
 */
export async function disconnectDrive(userId: string): Promise<{ migrated: number }> {
  const connection = await prisma.storageConnection.findUnique({
    where: { userId },
    select: { refreshToken: true, accessToken: true },
  });
  if (!connection) return { migrated: 0 };

  const keyPrefix = `gdrive/${userId}/`;
  const stored = await prisma.document.findMany({
    where: { storageKey: { startsWith: keyPrefix } },
    select: { id: true, storageKey: true, mimeType: true, deletedAt: true },
    take: 201,
  });
  if (stored.length > 200) {
    throw new Error('Too many documents are stored in Google Drive to move in one step. Delete some documents first.');
  }

  const { GoogleDriveStorage } = await import('../storage/google-drive');
  const { getStorage, generateStorageKey } = await import('../storage');
  const drive = new GoogleDriveStorage(userId);
  const local = getStorage();

  let migrated = 0;
  for (const document of stored) {
    const bytes = await drive.getObject(document.storageKey);
    const extension = document.storageKey.split('.').pop() ?? 'bin';
    const nextKey = generateStorageKey('drive-import', extension);
    await local.putObject(nextKey, bytes, { contentType: document.mimeType });
    await prisma.document.update({ where: { id: document.id }, data: { storageKey: nextKey } });
    await drive.deleteObject(document.storageKey).catch(() => undefined);
    migrated += 1;
  }

  await prisma.storageConnection.delete({ where: { userId } });
  await revokeToken(decryptOptional(connection.refreshToken, `drive:${userId}`) ?? '');

  logger.info('google_drive_disconnected', { userId, migrated });
  return { migrated };
}
