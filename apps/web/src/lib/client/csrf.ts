const CSRF_COOKIE = 'pp_csrf';

let inFlight: Promise<string | null> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Returns the double-submit CSRF token, creating it through the same-origin
 * bootstrap endpoint when the browser does not have one yet.
 */
export async function ensureCsrfToken(): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;

  if (!inFlight) {
    inFlight = fetch('/api/v1/auth/csrf', {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json().catch(() => null)) as
          | { data?: { csrfToken?: string } }
          | null;
        return payload?.data?.csrfToken ?? readCookie(CSRF_COOKIE);
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}
