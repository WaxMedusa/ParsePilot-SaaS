import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { CSRF_COOKIE } from '@/lib/auth/session';
import { generateCsrfToken } from '@/lib/auth/csrf';
import { isProduction } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

/**
 * Issues the double-submit CSRF token. This replaces the cookie that used to be
 * set by Edge middleware, which Vercel Services does not support.
 */
export const GET = withApi(
  async (request, context) => {
    const existing = request.cookies.get(CSRF_COOKIE)?.value;
    const token = existing && existing.length >= 32 ? existing : generateCsrfToken();
    const response = ok({ csrfToken: token }, { requestId: context.requestId });

    if (token !== existing) {
      response.cookies.set(CSRF_COOKIE, token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: isProduction,
        path: '/',
        maxAge: ONE_MONTH_SECONDS,
      });
    }

    return response;
  },
  { auth: 'none', csrf: false },
);
