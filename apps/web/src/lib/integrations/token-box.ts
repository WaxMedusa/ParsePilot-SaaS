import { encryptionAvailable, openSecret, sealSecret } from '../crypto/secret-box';

/**
 * Thin wrapper around the existing AES-256-GCM secret box, kept separate so
 * the OAuth integration can ask "can this deployment encrypt tokens?" without
 * importing the AI settings module.
 */
export function tokenEncryptionAvailable(): boolean {
  return encryptionAvailable();
}

export function encryptOptional(plaintext: string, associatedData: string): string {
  if (!tokenEncryptionAvailable()) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is required to store Google Drive tokens');
  }
  return sealSecret(plaintext, associatedData);
}

export function decryptOptional(sealed: string, associatedData: string): string | null {
  if (!sealed) return null;
  try {
    return openSecret(sealed, associatedData);
  } catch {
    return null;
  }
}
