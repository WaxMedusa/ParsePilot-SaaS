import { describe, expect, it, vi } from 'vitest';
import { hashPassword, validatePasswordPolicy, verifyPassword } from './password';

describe('password hashing', () => {
  it('never stores the plaintext and verifies the correct password', async () => {
    const stored = await hashPassword('Fixture-Password-2026!');
    expect(stored).not.toContain('Fixture-Password-2026!');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('Fixture-Password-2026!', stored)).resolves.toBe(true);
  });

  it('rejects an incorrect password and malformed hashes', async () => {
    const stored = await hashPassword('Fixture-Password-2026!');
    await expect(verifyPassword('ParsePilot-Demo-2025', stored)).resolves.toBe(false);
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'scrypt$broken')).resolves.toBe(false);
  });

  it('produces a different salt for each hash', async () => {
    const first = await hashPassword('Fixture-Password-2026!');
    const second = await hashPassword('Fixture-Password-2026!');
    expect(first).not.toBe(second);
    await expect(verifyPassword('Fixture-Password-2026!', second)).resolves.toBe(true);
  });
});

describe('password policy', () => {
  it('requires length and character variety', () => {
    expect(validatePasswordPolicy('short').ok).toBe(false);
    expect(validatePasswordPolicy('alllowercase123').ok).toBe(false);
    expect(validatePasswordPolicy('NoNumbersHere!').ok).toBe(false);
    expect(validatePasswordPolicy('Fixture-Password-2026!').ok).toBe(true);
  });

  it('rejects known common passwords', () => {
    expect(validatePasswordPolicy('Password123').ok).toBe(false);
    expect(validatePasswordPolicy('ParsePilot').problems).toContain('Include a number');
  });
});

describe('timing-safe comparison usage', () => {
  it('does not throw on hashes with different lengths', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(verifyPassword('x', 'scrypt$16384$8$1$AAAA$AAAA')).resolves.toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
