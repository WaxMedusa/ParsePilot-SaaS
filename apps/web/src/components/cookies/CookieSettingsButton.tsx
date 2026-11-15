'use client';

import { OPEN_COOKIE_SETTINGS_EVENT } from '@/lib/consent';

export function CookieSettingsButton({ variant = 'link' }: { variant?: 'link' | 'button' }) {
  const open = () => {
    window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
  };

  if (variant === 'button') {
    return (
      <button type="button" onClick={open} className="__cookieSettingsButton" style={{ display: 'none' }}>
        Cookie settings
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
      }}
    >
      Cookie settings
    </button>
  );
}
