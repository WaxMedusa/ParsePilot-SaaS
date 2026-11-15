import { createHmac, timingSafeEqual } from 'node:crypto';
import { downloadSigningSecret, appUrl } from '../env';

export type SignedFilePayload = {
  /** Storage object key (never the original filename). */
  key: string;
  /** Unix seconds expiry. */
  exp: number;
  /** Original filename for the content-disposition header. */
  name?: string;
  disposition?: 'inline' | 'attachment';
  mime?: string;
};

function sign(encoded: string): string {
  return createHmac('sha256', downloadSigningSecret()).update(encoded).digest('base64url');
}

export function signFilePayload(payload: SignedFilePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyFilePayload(token: string): SignedFilePayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedFilePayload;
    if (!payload.key || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildSignedFileUrl(payload: SignedFilePayload): string {
  const token = signFilePayload(payload);
  return `${appUrl}/api/v1/files/${encodeURIComponent(payload.key)}?token=${encodeURIComponent(token)}`;
}
