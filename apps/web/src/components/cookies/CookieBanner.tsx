'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Cookie, SlidersHorizontal, X } from 'lucide-react';
import { CONSENT_COOKIE, CONSENT_VERSION, OPEN_COOKIE_SETTINGS_EVENT, parseConsent, serializeConsent, type CookiePreferences } from '@/lib/consent';
import styles from './CookieBanner.module.css';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'summary' | 'customise'>('summary');
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = parseConsent(readCookie(CONSENT_COOKIE));
    if (stored) {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
    } else {
      const timer = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      const stored = parseConsent(readCookie(CONSENT_COOKIE));
      if (stored) {
        setAnalytics(stored.analytics);
        setMarketing(stored.marketing);
      }
      setMode('customise');
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handler);
    if (window.location.pathname === '/cookies' && window.location.hash === '#preferences') handler();
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handler);
  }, []);

  const persist = useCallback(
    async (preferences: CookiePreferences) => {
      setSaving(true);
      document.cookie = `${CONSENT_COOKIE}=${serializeConsent(preferences)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
      try {
        const csrf = readCookie('pp_csrf');
        await fetch('/api/v1/privacy/consent', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(csrf ? { 'x-csrf-token': csrf } : {}),
          },
          body: JSON.stringify({ analytics: preferences.analytics, marketing: preferences.marketing }),
          credentials: 'same-origin',
        });
      } catch {
        // The client cookie is authoritative for anonymous visitors; a failed
        // server sync must never block the preference being stored locally.
      } finally {
        setSaving(false);
        setOpen(false);
      }
    },
    [],
  );

  const acceptAll = () => persist({ essential: true, analytics: true, marketing: true, decidedAt: new Date().toISOString() });
  const rejectOptional = () => persist({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() });
  const saveCustom = () => persist({ essential: true, analytics, marketing, decidedAt: new Date().toISOString() });

  if (!mounted || !open) return null;

  return (
    <div className={styles.wrap} role="dialog" aria-modal="false" aria-labelledby="cookie-title" aria-describedby="cookie-description">
      <div className={styles.panel}>
        <div className={styles.head}>
          <span className={styles.icon}>
            <Cookie size={16} aria-hidden="true" />
          </span>
          <div className={styles.headText}>
            <h2 id="cookie-title" className={styles.title}>
              {mode === 'summary' ? 'Cookies on ParsePilot' : 'Cookie preferences'}
            </h2>
            <p id="cookie-description" className={styles.description}>
              {mode === 'summary'
                ? 'We use essential cookies to keep you signed in and protect forms. Optional analytics and marketing cookies are off until you turn them on.'
                : 'Essential cookies are always active. Choose whether optional categories may be used; you can change this at any time from the footer.'}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close cookie notice">
            <X size={14} />
          </button>
        </div>

        {mode === 'customise' ? (
          <div className={styles.options}>
            <div className={styles.option}>
              <div>
                <p className={styles.optionTitle}>Essential</p>
                <p className={styles.optionBody}>Session, CSRF protection and your cookie choice. These cannot be disabled.</p>
              </div>
              <span className={styles.alwaysOn}>
                <Check size={11} /> Always on
              </span>
            </div>
            <label className={styles.option}>
              <div>
                <p className={styles.optionTitle}>Analytics</p>
                <p className={styles.optionBody}>Aggregate usage measurement. No document contents are ever collected.</p>
              </div>
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className={styles.checkbox} />
            </label>
            <label className={styles.option}>
              <div>
                <p className={styles.optionTitle}>Marketing</p>
                <p className={styles.optionBody}>Campaign attribution cookies. Currently unused on this deployment.</p>
              </div>
              <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className={styles.checkbox} />
            </label>
          </div>
        ) : null}

        <div className={styles.actions}>
          {mode === 'summary' ? (
            <>
              <button type="button" className={styles.primary} onClick={acceptAll} disabled={saving}>
                Accept all
              </button>
              <button type="button" className={styles.secondary} onClick={rejectOptional} disabled={saving}>
                Reject optional
              </button>
              <button type="button" className={styles.ghost} onClick={() => setMode('customise')}>
                <SlidersHorizontal size={13} /> Customise
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.primary} onClick={saveCustom} disabled={saving}>
                Save preferences
              </button>
              <button type="button" className={styles.secondary} onClick={rejectOptional} disabled={saving}>
                Reject optional
              </button>
              <button type="button" className={styles.ghost} onClick={() => setMode('summary')}>
                Back
              </button>
            </>
          )}
          <Link href="/cookies" className={styles.learn}>
            Cookie Policy
          </Link>
        </div>
        <p className={styles.version}>Consent version {CONSENT_VERSION}. Preferences are stored for 12 months.</p>
      </div>
    </div>
  );
}
