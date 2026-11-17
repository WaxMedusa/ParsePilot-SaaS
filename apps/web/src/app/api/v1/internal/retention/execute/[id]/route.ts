import { z } from 'zod';
import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { claimJob } from '@/lib/jobs/service';
import { runRetentionSweep } from '@/lib/retention/service';
import { failJob } from '@/lib/jobs/service';
import { resumePendingDataExports } from '@/lib/privacy/data-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ workerId: z.string().trim().min(1).max(120) });

export const POST = withInternalService(async (request, context) => {
  const body = schema.parse(await request.json());
  const jobId = context.params.id;
  const job = await prisma.processingJob.findUnique({ where: { id: jobId }, select: { type: true } });
  if (!job || job.type !== 'retention_sweep') throw ApiError.notFound('Retention job not found');

  const claimed = await claimJob(jobId, body.workerId);
  if (!claimed) return ok({ executed: false, reason: 'not_claimable' }, { requestId: context.requestId });

  try {
    const summary = await runRetentionSweep();
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: 'succeeded',
        stage: 'completed',
        finishedAt: new Date(),
        activeKey: null,
        heartbeatAt: null,
        timings: { durationMs: 0, documentsPurged: summary.documentsPurged } as never,
      },
    });
    // Requests created while this sweep was running could not start a job of
    // their own; now that the active slot is free, start one for them.
    await resumePendingDataExports();
    return ok({ executed: true, summary }, { requestId: context.requestId });
  } catch (error) {
    await failJob(jobId, body.workerId, {
      code: 'retention_sweep_failed',
      message: error instanceof Error ? error.message : 'unknown',
      category: 'transient',
    });
    throw error;
  }
});
