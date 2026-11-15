import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { reconcileJobs } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withInternalService(async (request, context) => {
  const result = await reconcileJobs();
  return ok(result, { requestId: context.requestId });
});
