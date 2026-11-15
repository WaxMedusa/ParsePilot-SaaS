import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { failJob } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  workerId: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(1_000),
  category: z.enum(['transient', 'permanent', 'provider', 'timeout', 'quota']).optional(),
});

export const POST = withInternalService(async (request, context) => {
  const body = schema.parse(await request.json());
  const outcome = await failJob(context.params.id, body.workerId, {
    code: body.code,
    message: body.message,
    category: body.category,
  });
  return ok(outcome, { requestId: context.requestId });
});
