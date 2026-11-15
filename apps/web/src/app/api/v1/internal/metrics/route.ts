import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { prisma } from '@/lib/prisma';
import { metricsSnapshot } from '@/lib/observability/metrics';
import { queueLength } from '@/lib/redis';
import { appConfig } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withInternalService(async (request, context) => {
  const [jobsByStatus, failedLast24h, queueDepth, snapshot, oldestQueued] = await Promise.all([
    prisma.processingJob.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.processingJob.count({
      where: { status: { in: ['failed', 'dead_letter'] }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    queueLength(appConfig.queueName),
    metricsSnapshot(),
    prisma.processingJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  return ok(
    {
      jobs: Object.fromEntries(jobsByStatus.map((entry) => [entry.status, entry._count._all])),
      failedLast24h,
      queueDepth,
      oldestQueuedAgeSeconds: oldestQueued ? Math.round((Date.now() - oldestQueued.createdAt.getTime()) / 1000) : 0,
      counters: snapshot.counters,
      gauges: snapshot.gauges,
    },
    { requestId: context.requestId },
  );
});
