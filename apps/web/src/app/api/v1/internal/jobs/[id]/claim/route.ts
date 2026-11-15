import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { claimJob, jobSummary } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ workerId: z.string().trim().min(1).max(120) });

export const POST = withInternalService(async (request, context) => {
  const body = schema.parse(await request.json());
  const job = await claimJob(context.params.id, body.workerId);
  if (!job) {
    return ok({ claimed: false, reason: 'not_claimable' }, { requestId: context.requestId });
  }
  return ok({ claimed: true, job: jobSummary(job) }, { requestId: context.requestId });
});
