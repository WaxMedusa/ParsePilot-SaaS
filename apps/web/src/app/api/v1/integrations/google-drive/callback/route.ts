import { NextResponse } from 'next/server';
import { withApi } from '@/lib/http/handler';
import { appUrl } from '@/lib/env';
import { completeDriveConnection, driveConfigured, verifyOAuthState } from '@/lib/integrations/google-drive';
import { recordAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google redirects the browser here. CSRF is not applicable to a third-party
 * redirect, so the state token is HMAC-signed, short-lived and bound to the
 * signed-in account; a mismatch is refused.
 */
export const GET = withApi(
  async (request, context) => {
    const settingsUrl = `${appUrl}/dashboard/settings/profile`;
    const fail = (reason: string) => NextResponse.redirect(`${settingsUrl}?drive=${reason}`);

    if (!driveConfigured()) return fail('unconfigured');

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const denied = request.nextUrl.searchParams.get('error');

    if (denied) return fail('denied');
    if (!code || !state) return fail('invalid');

    const parsed = verifyOAuthState(state);
    if (!parsed || parsed.userId !== context.auth!.user.id) return fail('state');

    try {
      const result = await completeDriveConnection({ userId: parsed.userId, code });
      await recordAudit({
        action: 'integrations.drive_connected',
        actorId: parsed.userId,
        targetType: 'user',
        targetId: parsed.userId,
        metadata: { accountEmail: result.accountEmail },
      });
      return NextResponse.redirect(`${settingsUrl}?drive=connected`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      logger.warn('google_drive_connect_failed', { userId: parsed.userId, message });
      return fail('failed');
    }
  },
  { auth: 'required', workspace: false, csrf: false },
);
