import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { createJob } from '@/lib/jobs/service';
import { assertCanProcess } from '@/lib/billing/usage';
import { jobSummary } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (request, context) => {
    const document = await prisma.document.findFirst({
      where: { id: context.params.id, workspaceId: context.workspace!.id, deletedAt: null },
      select: { id: true, status: true, pageCount: true },
    });
    if (!document) throw ApiError.notFound('Document not found');

    const active = await prisma.processingJob.findUnique({ where: { activeKey: `document:${document.id}` } });
    if (active) {
      return ok(
        {
          job: jobSummary(active),
          alreadyQueued: true,
        },
        { status: 202, requestId: context.requestId },
      );
    }

    await assertCanProcess(context.workspace!.id, Math.max(1, document.pageCount ?? 1));

    const job = await createJob({
      workspaceId: context.workspace!.id,
      type: 'document_process',
      documentId: document.id,
      idempotencyKey: `doc:${document.id}:reprocess:${Date.now()}`,
      correlationId: context.requestId,
      onActiveConflict: 'throw',
    });
    await prisma.document.updateMany({
      where: { id: document.id, workspaceId: context.workspace!.id },
      data: { status: 'queued', failureCode: null, failureMessage: null },
    });

    return ok({ job: jobSummary(job), alreadyQueued: false }, { status: 202, requestId: context.requestId });
  },
  { workspace: { minRole: 'member' }, rateLimit: { limit: 20, windowMs: 60 * 60 * 1000, per: 'user' } },
);
