import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { recordStage } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  workerId: z.string().trim().min(1).max(120),
  stage: z.enum(['extracting_text', 'running_ocr', 'extracting_fields', 'validating', 'detecting_duplicates']),
});

export const POST = withInternalService(async (request, context) => {
  const body = schema.parse(await request.json());
  await recordStage(context.params.id, body.stage, body.workerId);
  return ok({ recorded: true, stage: body.stage }, { requestId: context.requestId });
});
