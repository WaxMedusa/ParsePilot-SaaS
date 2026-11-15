export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(message: string, options: { code: string; status: number; details?: unknown; requestId?: string }) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  workspaceId?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * Browser API helper. Adds the double-submit CSRF token for mutating requests
 * and surfaces structured API errors without leaking internals to the UI.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  if (method !== 'GET') {
    const csrf = readCookie('pp_csrf');
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  if (options.workspaceId) headers['x-workspace-id'] = options.workspaceId;

  const response = await fetch(path, {
    method,
    headers,
    body,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiClientError(error?.message ?? 'Something went wrong. Please try again.', {
      code: error?.code ?? 'request_failed',
      status: response.status,
      details: error?.details,
      requestId: (payload as { requestId?: string } | null)?.requestId,
    });
  }

  return ((payload as { data?: T } | null)?.data ?? (payload as T)) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
