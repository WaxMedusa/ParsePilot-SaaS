import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created } from '@/lib/http/respond';
import { requestAccountDeletion } from '@/lib/privacy/data-requests';
import { clearSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  password: z.string().min(1).max(200),
  confirmation: z.string().min(1).max(40),
  deleteWorkspaces: z.boolean(),
});

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const record = await requestAccountDeletion({
      userId: context.auth!.user.id,
      password: body.password,
      confirmation: body.confirmation,
      deleteWorkspaces: body.deleteWorkspaces,
    });
    await clearSessionCookie();
    return created(
      {
        id: record.id,
        status: record.status,
        graceEndsAt: 'graceEndsAt' in record ? record.graceEndsAt : null,
        message:
          'Account deletion is scheduled. All sessions have been signed out. You can cancel by contacting support with your account email until the grace period ends.',
      },
      { requestId: context.requestId },
    );
  },
  { auth: 'required', rateLimit: { limit: 5, windowMs: 60 * 60 * 1000, per: 'user' } },
);
