import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { nextQueuedJob } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Database-backed queue delivery. The worker polls this endpoint, then uses
 * the existing claim endpoint, which atomically moves the job to `running`.
 * Multiple workers may see the same id; only one claim succeeds.
 */
export const GET = withInternalService(async (_request, context) => {
  const job = await nextQueuedJob();
  return ok({ jobId: job?.id ?? null }, { requestId: context.requestId });
});
