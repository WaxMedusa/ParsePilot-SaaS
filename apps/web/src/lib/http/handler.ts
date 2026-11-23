import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError } from './errors';
import { errorResponse } from './respond';
import { getRequestId, getClientIp, hashIp, isMutatingMethod } from './request';
import { enforceRateLimit, rateLimitHeaders } from './rate-limit';
import { assertCsrf } from '../auth/csrf';
import { readSessionToken, resolveSessionToken, type SessionUser } from '../auth/session';
import {
  resolveDefaultWorkspace,
  resolveWorkspaceAccess,
  type WorkspaceAccess,
  type WorkspaceRole,
} from '../auth/authorization';
import { logger } from '../logger';
import { increment, observe } from '../observability/metrics';
import { WORKSPACE_COOKIE } from '../workspaces/cookie';

export type RequestAuth = { user: SessionUser; sessionId: string };

export type ApiContext = {
  requestId: string;
  ipHash: string;
  auth: RequestAuth | null;
  workspace: WorkspaceAccess | null;
  params: Record<string, string>;
};

export type ApiOptions = {
  auth?: 'required' | 'optional' | 'none';
  workspace?: { required?: boolean; minRole?: WorkspaceRole } | false;
  rateLimit?: { limit: number; windowMs: number; per?: 'ip' | 'user' };
  csrf?: boolean;
};

export type ApiHandler = (request: NextRequest, context: ApiContext) => Promise<Response> | Response;

type NextRouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

const WORKSPACE_HEADER = 'x-workspace-id';

function normalizeParams(rawParams: Record<string, string | string[] | undefined> | null | undefined): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams ?? {})) {
    params[key] = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }
  return params;
}

export function withApi(handler: ApiHandler, options: ApiOptions = {}) {
  const authMode = options.auth ?? 'required';
  const workspaceOption = options.workspace;
  const requiresWorkspace = workspaceOption !== undefined && workspaceOption !== false;
  const workspaceRequired = workspaceOption === undefined || (workspaceOption !== false && workspaceOption.required !== false);
  const minimumRole: WorkspaceRole = workspaceOption ? workspaceOption.minRole ?? 'viewer' : 'viewer';

  return async (request: NextRequest, routeContext: NextRouteContext): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = getRequestId(request);
    const ipHash = hashIp(getClientIp(request));

    try {
      const params = normalizeParams(await routeContext?.params);

      // --- Authentication -------------------------------------------------
      const token = await readSessionToken(request);
      const usesCookieAuth = Boolean(request.cookies.get('pp_session')?.value);
      let auth: RequestAuth | null = null;
      if (authMode !== 'none') {
        const session = token ? await resolveSessionToken(token) : null;
        if (session) auth = { user: session.user, sessionId: session.sessionId };
      }
      if (authMode === 'required' && !auth) throw ApiError.unauthorized();

      // --- CSRF -----------------------------------------------------------
      if (options.csrf !== false) {
        assertCsrf(request, { usesCookieAuth });
      }

      // --- Rate limiting --------------------------------------------------
      if (options.rateLimit) {
        const identity = options.rateLimit.per === 'user' && auth ? `u:${auth.user.id}` : `ip:${ipHash}`;
        const scope = `${request.nextUrl.pathname}:${identity}`;
        const result = await enforceRateLimit(scope, options.rateLimit.limit, options.rateLimit.windowMs);
        if (!result.allowed) throw ApiError.rateLimited(result.retryAfterSeconds);
      }

      // --- Workspace authorization ---------------------------------------
      let workspace: WorkspaceAccess | null = null;
      if (requiresWorkspace) {
        if (!auth) throw ApiError.unauthorized();
        const requested = request.headers.get(WORKSPACE_HEADER) ?? request.nextUrl.searchParams.get('workspaceId');
        if (requested) {
          if (!z.string().uuid().safeParse(requested).success) {
            throw ApiError.validation([{ path: 'workspaceId', message: 'Workspace id must be a UUID' }]);
          }
          workspace = await resolveWorkspaceAccess(auth.user.id, requested, minimumRole);
        } else {
          const cookieWorkspace = request.cookies.get(WORKSPACE_COOKIE)?.value;
          if (cookieWorkspace) {
            try {
              workspace = await resolveWorkspaceAccess(auth.user.id, cookieWorkspace, minimumRole);
            } catch {
              workspace = await resolveDefaultWorkspace(auth.user.id);
            }
          } else {
            workspace = await resolveDefaultWorkspace(auth.user.id);
          }
        }
        if (!workspace && workspaceRequired) {
          throw ApiError.forbidden('No workspace is available for this account');
        }
      }

      const response = await handler(request, { requestId, ipHash, auth, workspace, params });
      response.headers.set('x-request-id', requestId);
      if (auth) response.headers.set('Cache-Control', 'no-store, max-age=0');
      return response;
    } catch (error) {
      await increment('http_errors', {
        code: error instanceof ApiError ? error.code : 'internal_error',
        method: request.method,
      });
      return errorResponse(error, requestId);
    } finally {
      const duration = Date.now() - startedAt;
      await observe('http_request', duration, { method: request.method, route: request.nextUrl.pathname });
      if (isMutatingMethod(request.method)) {
        logger.info('api_request', { requestId, method: request.method, path: request.nextUrl.pathname, durationMs: duration });
      }
    }
  };
}

/** Internal service-to-service wrapper with shared token authentication. */
export function withInternalService(
  handler: (request: NextRequest, context: { requestId: string; params: Record<string, string> }) => Promise<Response>,
) {
  return async (request: NextRequest, routeContext: NextRouteContext): Promise<Response> => {
    const requestId = getRequestId(request);
    try {
      const { internalServiceToken } = await import('../env');
      const { constantTimeEquals } = await import('../auth/csrf');
      const provided = request.headers.get('x-internal-token') ?? '';
      if (!provided || !constantTimeEquals(provided, internalServiceToken())) {
        throw ApiError.unauthorized('Invalid service credentials');
      }
      const params = normalizeParams(await routeContext?.params);
      const response = await handler(request, { requestId, params });
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export type { WorkspaceAccess, SessionUser };
export { rateLimitHeaders };
export { NextResponse };