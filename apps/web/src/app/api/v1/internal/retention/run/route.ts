import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { prisma } from '@/lib/prisma';
import { createJob } from '@/lib/jobs/service';
import { ApiError } from '@/lib/http/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Called by the worker scheduler (hourly) to enqueue a retention sweep. */
export const POST = withInternalService(async (request, context) => {
  const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!workspace) throw ApiError.conflict('No workspace exists to anchor the maintenance job');

  const active = await prisma.processingJob.findUnique({ where: { activeKey: 'retention:sweep' } });
  if (active) return ok({ scheduled: false, jobId: active.id, reason: 'already_running' }, { requestId: context.requestId });

  const job = await createJob({
    workspaceId: workspace.id,
    type: 'retention_sweep',
    idempotencyKey: `retention:${new Date().toISOString().slice(0, 13)}`,
    correlationId: context.requestId,
    maxAttempts: 3,
    onActiveConflict: 'return_existing',
  });
  return ok({ scheduled: true, jobId: job.id }, { requestId: context.requestId });
});
