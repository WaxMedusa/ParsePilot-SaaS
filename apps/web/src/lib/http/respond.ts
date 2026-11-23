import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from './errors';
import { logger } from '../logger';

export type ApiMeta = Record<string, unknown> & { requestId?: string };

const BASE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export function ok<T>(data: T, options?: { status?: number; meta?: ApiMeta; headers?: Record<string, string>; requestId?: string }) {
  const status = options?.status ?? 200;
  const meta = options?.meta ? { ...options.meta } : undefined;
  return NextResponse.json(
    meta ? { data, meta } : { data },
    {
      status,
      headers: {
        ...BASE_HEADERS,
        ...(options?.requestId ? { 'x-request-id': options.requestId } : {}),
        ...options?.headers,
      },
    },
  );
}

export function created<T>(data: T, options?: { meta?: ApiMeta; headers?: Record<string, string>; requestId?: string }) {
  return ok(data, { ...options, status: 201 });
}

export function noContent(options?: { requestId?: string; headers?: Record<string, string> }) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...BASE_HEADERS,
      ...(options?.requestId ? { 'x-request-id': options.requestId } : {}),
      ...options?.headers,
    },
  });
}

/** Converts any thrown value into a safe, structured API error response. */
export function errorResponse(error: unknown, requestId: string, extraHeaders?: Record<string, string>): NextResponse {
  let status = 500;
  let code = 'internal_error';
  let message = 'Something went wrong. Please try again.';
  let details: unknown;
  let headers: Record<string, string> = {};

  if (error instanceof ApiError) {
    status = error.status;
    code = error.code;
    message = error.expose ? error.message : 'Something went wrong. Please try again.';
    details = error.expose ? error.details : undefined;
    if (error.status === 429) {
      const retryAfter = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      if (retryAfter) headers = { 'Retry-After': String(retryAfter) };
    }
  } else if (error instanceof ZodError) {
    status = 422;
    code = 'validation_failed';
    message = 'The submitted values are invalid';
    details = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      status = 409; code = 'conflict'; message = 'A record with these details already exists';
    } else if (error.code === 'P2025') {
      status = 404; code = 'not_found'; message = 'Resource not found';
    } else {
      status = 500; code = 'internal_error';
    }
  } else if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
    status = 504; code = 'service_unavailable'; message = 'The request timed out. Please try again.';
  }

  const shouldLog = status >= 500;
  if (shouldLog) {
    logger.error('api_error', {
      requestId,
      code,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: error instanceof Error ? error.message : 'unknown',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join(' | ') : undefined,
    });
  } else {
    logger.info('api_rejected', { requestId, code, status });
  }

  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) }, requestId },
    { status, headers: { ...BASE_HEADERS, 'x-request-id': requestId, ...headers, ...extraHeaders } },
  );
}