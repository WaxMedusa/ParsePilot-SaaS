export const CONSENT_COOKIE = 'pp_consent';
export const CONSENT_VERSION = '1.0-draft';
export const OPEN_COOKIE_SETTINGS_EVENT = 'pp:open-cookie-settings';

export type CookiePreferences = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export function parseConsent(raw: string | null | undefined): CookiePreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<CookiePreferences>;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.marketing !== 'boolean') return null;
    return {
      essential: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function serializeConsent(preferences: CookiePreferences): string {
  return encodeURIComponent(JSON.stringify(preferences));
}
