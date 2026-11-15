import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { renameWorkspace } from '@/lib/workspaces/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ name: z.string().trim().min(2).max(80) });

export const PATCH = withApi(
  async (request, context) => {
    if (context.params.id !== context.workspace!.id) {
      throw ApiError.forbidden('You can only update the workspace selected for this request');
    }
    const body = schema.parse(await request.json());
    const workspace = await renameWorkspace(context.workspace!.id, context.auth!.user.id, body.name);
    return ok({ id: workspace.id, name: workspace.name, slug: workspace.slug }, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' } },
);
