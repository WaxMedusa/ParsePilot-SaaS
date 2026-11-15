import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// OWASP-recommended scrypt parameters (N=2^14, r=8, p=1).
const PARAMS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64!, 'base64url');
    const expected = Buffer.from(hashB64!, 'base64url');
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456789',
  'qwertyuiop',
  'letmein123',
  'welcome123',
  'admin12345',
  'parsepilot',
]);

export type PasswordPolicyResult = { ok: boolean; problems: string[] };

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const problems: string[] = [];
  if (password.length < 10) problems.push('Use at least 10 characters');
  if (password.length > 200) problems.push('Use at most 200 characters');
  if (!/[a-z]/.test(password)) problems.push('Include a lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('Include an uppercase letter');
  if (!/[0-9]/.test(password)) problems.push('Include a number');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push('This password is too common');
  return { ok: problems.length === 0, problems };
}
