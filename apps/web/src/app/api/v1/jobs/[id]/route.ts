import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { getJobForWorkspace, jobSummary } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const job = await getJobForWorkspace(context.params.id, context.workspace!.id);
    return ok(
      {
        ...jobSummary(job),
        timings: job.timings,
        idempotencyKey: job.idempotencyKey,
        lockedBy: job.lockedBy ? 'worker' : null,
      },
      { requestId: context.requestId },
    );
  },
  { workspace: { minRole: 'viewer' } },
);
