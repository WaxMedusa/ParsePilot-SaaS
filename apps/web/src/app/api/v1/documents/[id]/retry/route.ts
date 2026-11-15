import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { retryJob, jobSummary } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (request, context) => {
    const document = await prisma.document.findFirst({
      where: { id: context.params.id, workspaceId: context.workspace!.id, deletedAt: null },
      select: { id: true },
    });
    if (!document) throw ApiError.notFound('Document not found');

    const job = await prisma.processingJob.findFirst({
      where: {
        documentId: document.id,
        workspaceId: context.workspace!.id,
        status: { in: ['failed', 'dead_letter'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!job) throw ApiError.conflict('There is no failed job to retry for this document');

    const retried = await retryJob(context.workspace!.id, job.id, context.auth!.user.id);
    return ok({ job: jobSummary(retried) }, { status: 202, requestId: context.requestId });
  },
  { workspace: { minRole: 'member' }, rateLimit: { limit: 30, windowMs: 60 * 60 * 1000, per: 'user' } },
);
