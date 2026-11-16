'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CONSENT_COOKIE, CONSENT_VERSION, OPEN_COOKIE_SETTINGS_EVENT, parseConsent, serializeConsent, type CookiePreferences } from '@/lib/consent';
import { ensureCsrfToken } from '@/lib/client/csrf';
import styles from './CookieBanner.module.css';

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function CookiePreferencesPanel() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = parseConsent(readCookie(CONSENT_COOKIE));
    if (stored) {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
      setSaved(stored.decidedAt);
    }
  }, []);

  const persist = async (preferences: CookiePreferences) => {
    setSaving(true);
    document.cookie = `${CONSENT_COOKIE}=${serializeConsent(preferences)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    try {
      const csrf = await ensureCsrfToken();
      await fetch('/api/v1/privacy/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({ analytics: preferences.analytics, marketing: preferences.marketing }),
        credentials: 'same-origin',
      });
    } catch {
      // Local persistence still succeeded.
    }
    setSaving(false);
    setSaved(preferences.decidedAt);
  };

  return (
    <div id="preferences" style={{ scrollMarginTop: '96px' }}>
      <div className={styles.options} style={{ marginTop: 0 }}>
        <div className={styles.option}>
          <div>
            <p className={styles.optionTitle}>Essential cookies</p>
            <p className={styles.optionBody}>Session, CSRF protection and consent storage. Required for the service to work.</p>
          </div>
          <span className={styles.alwaysOn}>
            <Check size={11} /> Always on
          </span>
        </div>
        <label className={styles.option}>
          <div>
            <p className={styles.optionTitle}>Analytics cookies</p>
            <p className={styles.optionBody}>Optional. No analytics scripts are currently loaded on this deployment.</p>
          </div>
          <input type="checkbox" className={styles.checkbox} checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
        </label>
        <label className={styles.option}>
          <div>
            <p className={styles.optionTitle}>Marketing cookies</p>
            <p className={styles.optionBody}>Optional. No advertising or attribution scripts are currently loaded.</p>
          </div>
          <input type="checkbox" className={styles.checkbox} checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
        </label>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={saving}
          onClick={() => persist({ essential: true, analytics, marketing, decidedAt: new Date().toISOString() })}
        >
          Save preferences
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={saving}
          onClick={() => {
            setAnalytics(false);
            setMarketing(false);
            persist({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() });
          }}
        >
          Reject optional
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))}
        >
          Open consent dialog
        </button>
      </div>
      <p className={styles.version}>
        {saved ? `Last saved ${new Date(saved).toISOString().slice(0, 10)} · ` : 'No preference saved yet · '}
        Consent version {CONSENT_VERSION}
      </p>
    </div>
  );
}
