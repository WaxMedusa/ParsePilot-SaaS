import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { completeDocumentProcessing } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fieldSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().max(8_000).nullable(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const schema = z.object({
  workerId: z.string().trim().min(1).max(120),
  result: z.object({
    pagesProcessed: z.number().int().min(1).max(5_000),
    ocrUsed: z.boolean(),
    kind: z.string().max(40).default('unknown'),
    language: z.string().max(20).nullable().optional(),
    provider: z.string().max(80).nullable().optional(),
    model: z.string().max(120).nullable().optional(),
    durationMs: z.number().int().min(0).max(3_600_000).optional(),
    fields: z.array(fieldSchema).max(120),
    duplicateCandidate: z
      .object({ documentId: z.string().uuid(), score: z.number().min(0).max(1) })
      .nullable()
      .optional(),
    warnings: z.array(z.string().max(300)).max(20).optional(),
  }),
});

export const POST = withInternalService(async (request, context) => {
  const body = schema.parse(await request.json());
  const result = await completeDocumentProcessing(context.params.id, body.workerId, body.result);
  return ok(result, { requestId: context.requestId });
});
