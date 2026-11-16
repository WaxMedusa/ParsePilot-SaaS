import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { CSRF_COOKIE } from './session';
import { ApiError } from '../http/errors';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Rejects cross-site mutations. Cookie-authenticated requests must carry a
 * matching double-submit token and an Origin that matches the request host.
 * Bearer-token requests (server-to-server clients) are not cookie-driven and
 * therefore not subject to CSRF.
 */
export function assertCsrf(request: NextRequest, options: { usesCookieAuth: boolean }): void {
  const method = request.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
  if (!options.usesCookieAuth) return;

  const origin = request.headers.get('origin');
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    const requestHost = request.headers.get('host');
    if (!originHost || !requestHost || originHost !== requestHost) {
      throw new ApiError(403, 'origin_rejected', 'Cross-origin request rejected');
    }
  }

  const headerToken = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  if (!headerToken || !cookieToken || !constantTimeEquals(headerToken, cookieToken)) {
    throw new ApiError(403, 'csrf_failed', 'Missing or invalid CSRF token');
  }
}

/** Same-origin check used for non-cookie mutations (internal service calls excluded). */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (!originHost || originHost !== request.headers.get('host')) {
    throw new ApiError(403, 'origin_rejected', 'Cross-origin request rejected');
  }
}
