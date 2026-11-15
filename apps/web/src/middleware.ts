import { NextResponse, type NextRequest } from 'next/server';

const CSRF_COOKIE = 'pp_csrf';
const SESSION_COOKIE = 'pp_session';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Edge middleware:
 *  - issues the double-submit CSRF token used by browser API calls
 *  - guarantees a request id for correlation
 *  - sends unauthenticated dashboard visitors to sign in
 * Authorization itself is always re-checked server-side; this is only a
 * usability redirect and never a security boundary.
 */
export function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const path = request.nextUrl.pathname;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (path.startsWith('/dashboard') && !hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);

  if (!request.cookies.get(CSRF_COOKIE)) {
    const csrfToken = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
