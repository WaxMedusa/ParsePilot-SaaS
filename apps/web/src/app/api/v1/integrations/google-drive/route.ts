import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { disconnectDrive, driveAuthorizeUrl, driveConfigured, getDriveStatus } from '@/lib/integrations/google-drive';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Whether this account has (or can have) its own Google Drive storage. */
export const GET = withApi(
  async (_request, context) => {
    const status = await getDriveStatus(context.auth!.user.id);
    return ok(
      {
        ...status,
        // Kept server-side: the browser never needs the client secret.
        canConnect: status.configured && status.encryptionAvailable && !status.connected,
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'required', workspace: false },
);

/** Starts the OAuth handshake; the client navigates to the returned URL. */
export const POST = withApi(
  async (_request, context) => {
    if (!driveConfigured()) {
      throw ApiError.conflict('Google Drive is not configured on this deployment');
    }
    const userId = context.auth!.user.id;
    const status = await getDriveStatus(userId);
    if (!status.encryptionAvailable) {
      throw ApiError.conflict(
        'Token storage is not configured. An administrator must set SETTINGS_ENCRYPTION_KEY before Drive can be connected.',
      );
    }
    await recordAudit({
      action: 'integrations.drive_connect_started',
      actorId: userId,
      targetType: 'user',
      targetId: userId,
    });
    return ok({ authorizeUrl: driveAuthorizeUrl(userId) }, { requestId: context.requestId });
  },
  {
    auth: 'required',
    workspace: false,
    rateLimit: { limit: 10, windowMs: 60 * 60 * 1000, per: 'user' },
  },
);

/** Disconnects Drive, copying anything stored there back first. */
export const DELETE = withApi(
  async (_request, context) => {
    const userId = context.auth!.user.id;
    try {
      const result = await disconnectDrive(userId);
      await recordAudit({
        action: 'integrations.drive_disconnected',
        actorId: userId,
        targetType: 'user',
        targetId: userId,
        metadata: { migrated: result.migrated },
      });
      return ok({ connected: false, migrated: result.migrated }, { requestId: context.requestId });
    } catch (error) {
      throw ApiError.conflict(error instanceof Error ? error.message : 'Google Drive could not be disconnected');
    }
  },
  {
    auth: 'required',
    workspace: false,
    rateLimit: { limit: 10, windowMs: 60 * 60 * 1000, per: 'user' },
  },
);
