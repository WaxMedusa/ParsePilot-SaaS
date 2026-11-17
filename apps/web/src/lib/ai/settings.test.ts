import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openSecret, sealSecret } from '../crypto/secret-box';

const mocks = vi.hoisted(() => ({
  prisma: {
    aiSettings: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { getAiSettingsView, resolveAiConfig, saveAiSettings, validateAiBaseUrl } from './settings';

const KEY_HEX = 'a'.repeat(64);

describe('secret box', () => {
  beforeEach(() => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', KEY_HEX);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips a key and rejects a tampered envelope', () => {
    const sealed = sealSecret('sk-test-1234567890', 'workspace-a');
    expect(openSecret(sealed, 'workspace-a')).toBe('sk-test-1234567890');
    expect(() => openSecret(sealed, 'workspace-b')).toThrow();
    const tampered = `${sealed.slice(0, -1)}A`;
    expect(() => openSecret(tampered, 'workspace-a')).toThrow();
  });
});

describe('AI settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', KEY_HEX);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('never exposes the stored key in the settings view', async () => {
    mocks.prisma.aiSettings.findUnique.mockResolvedValue({
      enabled: true,
      baseUrl: 'https://provider.test/v1',
      model: 'gemini-2.5-flash',
      apiKeyCiphertext: sealSecret('workspace-secret-key', 'ws-1'),
      apiKeyHint: '••••-key',
      updatedAt: new Date('2026-11-17T10:00:00Z'),
    });

    const view = await getAiSettingsView('ws-1');
    expect(view).toEqual({
      configured: true,
      encryptionAvailable: true,
      enabled: true,
      baseUrl: 'https://provider.test/v1',
      model: 'gemini-2.5-flash',
      keyHint: '••••-key',
      updatedAt: '2026-11-17T10:00:00.000Z',
    });
    expect(JSON.stringify(view)).not.toContain('workspace-secret-key');
  });

  it('decrypts the key for a job, but a disabled override blocks the deployment key', async () => {
    const row = {
      enabled: true,
      baseUrl: 'https://provider.test/v1',
      model: 'gemini-2.5-flash',
      apiKeyCiphertext: sealSecret('workspace-secret-key', 'ws-1'),
      apiKeyHint: '••••-key',
      updatedAt: new Date(),
    };
    mocks.prisma.aiSettings.findUnique.mockResolvedValue(row);
    expect(await resolveAiConfig('ws-1')).toEqual({
      baseUrl: 'https://provider.test/v1',
      model: 'gemini-2.5-flash',
      apiKey: 'workspace-secret-key',
    });

    // An explicit empty key tells the worker to run rules only, not fall back.
    mocks.prisma.aiSettings.findUnique.mockResolvedValue({ ...row, enabled: false });
    expect(await resolveAiConfig('ws-1')).toEqual({
      baseUrl: 'https://provider.test/v1',
      model: 'gemini-2.5-flash',
      apiKey: '',
    });

    mocks.prisma.aiSettings.findUnique.mockResolvedValue(null);
    expect(await resolveAiConfig('ws-1')).toBeNull();
  });

  it('keeps the stored key when a save omits it', async () => {
    const stored = sealSecret('workspace-secret-key', 'ws-1');
    mocks.prisma.aiSettings.findUnique.mockResolvedValue({
      enabled: true,
      baseUrl: 'https://provider.test/v1',
      model: 'old-model',
      apiKeyCiphertext: stored,
      apiKeyHint: '••••-key',
      updatedAt: new Date(),
    });
    mocks.prisma.aiSettings.upsert.mockImplementation(({ update }) => ({
      ...update,
      updatedAt: new Date('2026-11-17T12:00:00Z'),
    }));

    await saveAiSettings({
      workspaceId: 'ws-1',
      userId: 'user-1',
      enabled: true,
      baseUrl: 'https://provider.test/v1',
      model: 'new-model',
    });

    const call = mocks.prisma.aiSettings.upsert.mock.calls[0][0];
    expect(call.update.model).toBe('new-model');
    expect(call.update.apiKeyCiphertext).toBe(stored);
    expect(call.update.apiKeyHint).toBe('••••-key');
  });

  it('requires a key on the first save and rejects internal provider URLs', async () => {
    mocks.prisma.aiSettings.findUnique.mockResolvedValue(null);

    await expect(
      saveAiSettings({ workspaceId: 'ws-1', userId: 'user-1', enabled: true, baseUrl: 'https://provider.test/v1', model: 'm' }),
    ).rejects.toMatchObject({
      code: 'validation_failed',
      details: [{ path: 'apiKey', message: 'Enter an API key' }],
    });

    expect(validateAiBaseUrl('http://provider.test/v1')).toMatch(/HTTPS/);
    expect(validateAiBaseUrl('https://127.0.0.1/v1')).toMatch(/public host/);
    expect(validateAiBaseUrl('https://provider.test/v1')).toBeNull();
  });
});
