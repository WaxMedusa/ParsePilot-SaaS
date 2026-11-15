import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created } from '@/lib/http/respond';
import { requestWorkspaceDeletion } from '@/lib/privacy/data-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ confirmation: z.string().min(1).max(40) });

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const record = await requestWorkspaceDeletion({
      workspaceId: context.workspace!.id,
      userId: context.auth!.user.id,
      confirmation: body.confirmation,
    });
    return created(
      {
        id: record.id,
        status: record.status,
        graceEndsAt: 'graceEndsAt' in record ? record.graceEndsAt : null,
        message: 'Workspace deletion is scheduled. Documents and storage objects will be removed after the grace period.',
      },
      { requestId: context.requestId },
    );
  },
  { workspace: { minRole: 'owner' }, rateLimit: { limit: 5, windowMs: 24 * 60 * 60 * 1000, per: 'user' } },
);
