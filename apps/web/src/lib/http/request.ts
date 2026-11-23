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
  return forwarded ? forwarded.split(',')[0]!.trim() : request.headers.get('x-real-ip') ?? 'unknown';
}

export function hashIp(ip: string): string {
  return createHmac('sha256', sessionSecret()).update(ip).digest('hex').slice(0, 32);
}

export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}