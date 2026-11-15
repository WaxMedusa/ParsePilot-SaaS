import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { getDocumentDetail, updateDocument, deleteDocument } from '@/lib/documents/service';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  originalName: z.string().trim().min(1).max(180).optional(),
  kind: z.enum(['invoice', 'receipt', 'purchase_order', 'credit_note', 'bank_statement', 'contract', 'other', 'unknown']).optional(),
});

export const GET = withApi(
  async (request, context) => {
    const detail = await getDocumentDetail(context.params.id, context.workspace!.id);
    await recordAudit({
      action: 'document.viewed',
      workspaceId: context.workspace!.id,
      actorId: context.auth!.user.id,
      targetType: 'document',
      targetId: detail.id,
      requestId: context.requestId,
    });
    return ok(detail, { requestId: context.requestId });
  },
  { workspace: { minRole: 'viewer' } },
);

export const PATCH = withApi(
  async (request, context) => {
    const body = patchSchema.parse(await request.json());
    const document = await updateDocument({
      documentId: context.params.id,
      workspaceId: context.workspace!.id,
      actorId: context.auth!.user.id,
      data: body,
    });
    return ok(document, { requestId: context.requestId });
  },
  { workspace: { minRole: 'member' } },
);

export const DELETE = withApi(
  async (request, context) => {
    const result = await deleteDocument({
      documentId: context.params.id,
      workspaceId: context.workspace!.id,
      actorId: context.auth!.user.id,
    });
    return ok(result, { requestId: context.requestId });
  },
  { workspace: { minRole: 'member' } },
);
