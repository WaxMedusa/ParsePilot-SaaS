import { createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl, downloadSigningSecret } from '../env';

/**
 * Permanent capability link for the live workbook.
 *
 * A downloaded .xlsx is a static copy, so the only way a workbook can stay
 * current is to rebuild it whenever it is opened. This token names the
 * workspace and proves the link was minted by this deployment; it is derived
 * from DOWNLOAD_SIGNING_SECRET, so rotating that secret revokes every live
 * link. Anyone holding the link can download that workspace's export.
 */

const WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signature(workspaceId: string): string {
  return createHmac('sha256', downloadSigningSecret()).update(`live-workbook:${workspaceId}`).digest('base64url');
}

export function createLiveWorkbookToken(workspaceId: string): string {
  const encoded = Buffer.from(workspaceId, 'utf8').toString('base64url');
  return `${encoded}.${signature(workspaceId)}`;
}

/** Returns the workspace the token was minted for, or null when it is not ours. */
export function readLiveWorkbookToken(token: string): string | null {
  const [encoded, provided] = token.split('.');
  if (!encoded || !provided) return null;
  const workspaceId = Buffer.from(encoded, 'base64url').toString('utf8');
  if (!WORKSPACE_ID.test(workspaceId)) return null;

  const expected = Buffer.from(signature(workspaceId));
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;
  return workspaceId;
}

export function liveWorkbookPath(workspaceId: string): string {
  return `/api/v1/exports/live/${createLiveWorkbookToken(workspaceId)}`;
}

/** Absolute URL, suitable for Excel or Google Sheets. */
export function liveWorkbookUrl(workspaceId: string): string {
  return `${appUrl}${liveWorkbookPath(workspaceId)}`;
}
