import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { optionalEnv } from '../env';

/**
 * Envelope for small secrets that must be read back later (unlike passwords,
 * which are one-way hashes). AES-256-GCM authenticates both the ciphertext and
 * the associated data, so a sealed key cannot be moved to another record.
 */

const VERSION = 'v1';

export function encryptionAvailable(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

function encryptionKey(): Buffer {
  const raw = optionalEnv('SETTINGS_ENCRYPTION_KEY');
  if (!raw) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is required to store provider API keys');
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64)');
  }
  return key;
}

export function sealSecret(plaintext: string, associatedData: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(
    '.',
  );
}

export function openSecret(sealed: string, associatedData: string): string {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unrecognised secret envelope');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(parts[1]!, 'base64url'));
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  decipher.setAuthTag(Buffer.from(parts[2]!, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(parts[3]!, 'base64url')), decipher.final()]).toString('utf8');
}
