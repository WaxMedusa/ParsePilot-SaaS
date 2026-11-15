import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { updateFieldValue } from '@/lib/documents/repository';
import { normalizeFieldValue, FIELD_BY_KEY } from '@/lib/documents/fields';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ value: z.string().max(8_000).nullable() });

export const PATCH = withApi(
  async (request, context) => {
    const body = schema.parse(await request.json());
    const target = await prisma.extractionField.findFirst({
      where: {
        id: context.params.fieldId,
        documentId: context.params.id,
        document: { workspaceId: context.workspace!.id, deletedAt: null },
      },
      select: { fieldKey: true },
    });
    if (!target) throw ApiError.notFound('Field not found');

    if (body.value !== null && body.value !== '') {
      const normalized = normalizeFieldValue(FIELD_BY_KEY.get(target.fieldKey), body.value);
      if (normalized.issue) {
        throw ApiError.validation([{ path: 'value', message: normalized.issue }]);
      }
    }

    const updated = await updateFieldValue({
      workspaceId: context.workspace!.id,
      documentId: context.params.id,
      fieldId: context.params.fieldId,
      editedValue: body.value === '' ? null : body.value,
      editorId: context.auth!.user.id,
    });

    await recordAudit({
      action: 'document.field_edited',
      workspaceId: context.workspace!.id,
      actorId: context.auth!.user.id,
      targetType: 'document',
      targetId: context.params.id,
      requestId: context.requestId,
      metadata: { fieldKey: updated.fieldKey, edited: body.value !== null },
    });

    return ok(
      {
        id: updated.id,
        key: updated.fieldKey,
        editedValue: updated.editedValue,
        originalValue: updated.originalValue,
        normalizedValue: updated.normalizedValue,
        editedAt: updated.editedAt?.toISOString() ?? null,
      },
      { requestId: context.requestId },
    );
  },
  { workspace: { minRole: 'member' } },
);
