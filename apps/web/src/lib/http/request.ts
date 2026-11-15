import { createHmac, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { sessionSecret } from '../env';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

export function getRequestId(request: NextRequest): string {
  const inbound = request.headers.get('x-request-id');
  return inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : randomUUID();
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** IP addresses are pseudonymised before storage or logging. */
export function hashIp(ip: string): string {
  return createHmac('sha256', sessionSecret()).update(ip).digest('hex').slice(0, 32);
}

export function isMutatingMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export function clientIpForRequest(request: NextRequest): string {
  return getClientIp(request);
}
