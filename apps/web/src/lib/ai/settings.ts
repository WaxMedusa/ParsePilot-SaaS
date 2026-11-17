import { prisma } from '../prisma';
import { ApiError } from '../http/errors';
import { logger } from '../logger';
import { encryptionAvailable, openSecret, sealSecret } from '../crypto/secret-box';

/**
 * Per-workspace AI provider configuration. Extraction jobs receive the
 * decrypted key through the internal job context; the key never leaves the
 * server otherwise, and API responses expose only a last-4 hint.
 */

export const AI_SETTINGS_DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
} as const;

const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;

export type AiSettingsView = {
  configured: boolean;
  encryptionAvailable: boolean;
  enabled: boolean;
  baseUrl: string;
  model: string;
  keyHint: string | null;
  updatedAt: string | null;
};

export type AiProviderConfig = { baseUrl: string; model: string; apiKey: string };

type SettingsRow = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeyHint: string;
  updatedAt: Date;
};

function keyHint(apiKey: string): string {
  return `••••${apiKey.slice(-4)}`;
}

function toView(row: SettingsRow | null): AiSettingsView {
  return {
    configured: Boolean(row),
    encryptionAvailable: encryptionAvailable(),
    enabled: row?.enabled ?? true,
    baseUrl: row?.baseUrl ?? AI_SETTINGS_DEFAULTS.baseUrl,
    model: row?.model ?? AI_SETTINGS_DEFAULTS.model,
    keyHint: row?.apiKeyHint ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

/** Rejects URLs that would make the worker call an internal address (SSRF). */
export function validateAiBaseUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Enter a valid provider URL';
  }
  if (url.protocol !== 'https:') return 'The provider URL must use HTTPS';
  if (url.username || url.password) return 'The provider URL must not contain credentials';
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '[::1]' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return 'The provider URL must be a public host';
  }
  if (/^(?:127\.|10\.|0\.0\.0\.0$|169\.254\.|192\.168\.)/.test(host)) return 'The provider URL must be a public host';
  if (/^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return 'The provider URL must be a public host';
  return null;
}

export async function getAiSettingsView(workspaceId: string): Promise<AiSettingsView> {
  return toView(await prisma.aiSettings.findUnique({ where: { workspaceId } }));
}

export async function saveAiSettings(input: {
  workspaceId: string;
  userId: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<AiSettingsView> {
  const baseUrlError = validateAiBaseUrl(input.baseUrl);
  if (baseUrlError) throw ApiError.validation([{ path: 'baseUrl', message: baseUrlError }]);
  if (!MODEL_PATTERN.test(input.model)) {
    throw ApiError.validation([{ path: 'model', message: 'Use a provider model identifier, for example gpt-4.1-mini' }]);
  }
  if (input.apiKey && input.apiKey.length < 10) {
    throw ApiError.validation([{ path: 'apiKey', message: 'This API key looks too short' }]);
  }
  if (!encryptionAvailable()) {
    throw ApiError.conflict(
      'Provider key storage is not configured on this deployment. An administrator must set SETTINGS_ENCRYPTION_KEY.',
    );
  }

  const apiKey = input.apiKey?.trim();
  const existing = await prisma.aiSettings.findUnique({ where: { workspaceId: input.workspaceId } });
  const ciphertext = apiKey ? sealSecret(apiKey, input.workspaceId) : existing?.apiKeyCiphertext;
  const hint = apiKey ? keyHint(apiKey) : existing?.apiKeyHint;
  if (!ciphertext || !hint) {
    throw ApiError.validation([{ path: 'apiKey', message: 'Enter an API key' }]);
  }

  const row = await prisma.aiSettings.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      enabled: input.enabled,
      baseUrl: input.baseUrl,
      model: input.model,
      apiKeyCiphertext: ciphertext,
      apiKeyHint: hint,
      updatedById: input.userId,
    },
    update: {
      enabled: input.enabled,
      baseUrl: input.baseUrl,
      model: input.model,
      apiKeyCiphertext: ciphertext,
      apiKeyHint: hint,
      updatedById: input.userId,
    },
  });
  return toView(row);
}

export async function clearAiSettings(workspaceId: string): Promise<void> {
  await prisma.aiSettings.deleteMany({ where: { workspaceId } });
}

/**
 * Provider credentials for one extraction job.
 *
 * null means the workspace has no override, so the deployment default applies.
 * An object with an empty apiKey means the workspace configured AI but turned
 * it off (or its key cannot be read): the rules run and the deployment key is
 * deliberately not used on the workspace's behalf.
 */
export async function resolveAiConfig(workspaceId: string): Promise<AiProviderConfig | null> {
  const row = await prisma.aiSettings.findUnique({ where: { workspaceId } });
  if (!row) return null;
  const base = { baseUrl: row.baseUrl, model: row.model };
  if (!row.enabled) return { ...base, apiKey: '' };
  try {
    return { ...base, apiKey: openSecret(row.apiKeyCiphertext, workspaceId) };
  } catch (error) {
    logger.error('ai_settings_decrypt_failed', {
      workspaceId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return { ...base, apiKey: '' };
  }
}
