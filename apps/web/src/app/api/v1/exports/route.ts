import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created, ok } from '@/lib/http/respond';
import { createExport, listExports } from '@/lib/exports/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  format: z.enum(['csv', 'xlsx']),
  filters: z.record(z.unknown()).optional(),
});

export const GET = withApi(
  async (request, context) => {
    const exports = await listExports(context.workspace!.id);
    return ok(exports, { requestId: context.requestId });
  },
  { workspace: { minRole: 'viewer' } },
);

export const POST = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const result = await createExport({
      workspaceId: context.workspace!.id,
      userId: context.auth!.user.id,
      format: body.format,
      filters: body.filters,
      correlationId: context.requestId,
    });
    return created(
      {
        export: {
          id: result.export.id,
          format: result.export.format,
          status: result.export.status,
          createdAt: result.export.createdAt.toISOString(),
        },
        job: { id: result.job.id, status: result.job.status },
      },
      { requestId: context.requestId },
    );
  },
  { workspace: { minRole: 'member' }, rateLimit: { limit: 12, windowMs: 60 * 60 * 1000, per: 'user' } },
);
