import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created, ok } from '@/lib/http/respond';
import { createAccountExportRequest, createWorkspaceExportRequest, listDataRequests } from '@/lib/privacy/data-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  type: z.enum(['account_export', 'workspace_export']),
});

export const GET = withApi(
  async (request, context) => {
    const requests = await listDataRequests(context.auth!.user.id);
    return ok(requests, { requestId: context.requestId });
  },
  { auth: 'required' },
);

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const record =
      body.type === 'workspace_export'
        ? await createWorkspaceExportRequest(context.auth!.user.id, context.workspace!.id)
        : await createAccountExportRequest(context.auth!.user.id, context.workspace?.id ?? null);
    return created(
      {
        id: record.id,
        type: record.type,
        status: record.status,
        createdAt: record.createdAt.toISOString(),
        note: 'Your export is prepared by a background job and will appear here when ready.',
      },
      { requestId: context.requestId },
    );
  },
  { workspace: { minRole: 'viewer' }, rateLimit: { limit: 6, windowMs: 24 * 60 * 60 * 1000, per: 'user' } },
);
