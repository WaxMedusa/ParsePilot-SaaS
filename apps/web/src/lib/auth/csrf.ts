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
  return bufA.length === bufB.length && bufA.length > 0 && timingSafeEqual(bufA, bufB);
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getOriginHost(origin: string | null): string | null {
  try {
    return origin ? new URL(origin).host : null;
  } catch {
    return null;
  }
}

/** Rejects cross-site mutations for cookie-authenticated requests. */
export function assertCsrf(request: NextRequest, options: { usesCookieAuth: boolean }): void {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return;
  if (!options.usesCookieAuth) return;

  const originHost = getOriginHost(request.headers.get('origin'));
  const requestHost = request.headers.get('host');
  if (originHost && requestHost && originHost !== requestHost) {
    throw new ApiError(403, 'origin_rejected', 'Cross-origin request rejected');
  }

  const headerToken = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  if (!headerToken || !cookieToken || !constantTimeEquals(headerToken, cookieToken)) {
    throw new ApiError(403, 'csrf_failed', 'Missing or invalid CSRF token');
  }
}

/** Same-origin check for non-cookie mutations (excludes internal service calls). */
export function assertSameOrigin(request: NextRequest): void {
  const originHost = getOriginHost(request.headers.get('origin'));
  if (!originHost) return;
  const requestHost = request.headers.get('host');
  if (originHost !== requestHost) {
    throw new ApiError(403, 'origin_rejected', 'Cross-origin request rejected');
  }
}