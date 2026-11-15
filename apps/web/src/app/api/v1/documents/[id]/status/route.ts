import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const document = await prisma.document.findFirst({
      where: { id: context.params.id, workspaceId: context.workspace!.id, deletedAt: null },
      select: { id: true, status: true, failureCode: true, failureMessage: true, updatedAt: true },
    });
    if (!document) throw ApiError.notFound('Document not found');

    const job = await prisma.processingJob.findFirst({
      where: { documentId: document.id, workspaceId: context.workspace!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        stage: true,
        attempts: true,
        maxAttempts: true,
        errorCode: true,
        errorMessage: true,
        availableAt: true,
      },
    });

    return ok(
      {
        documentId: document.id,
        status: document.status,
        terminal: ['completed', 'needs_review', 'failed'].includes(document.status),
        failure: document.failureCode ? { code: document.failureCode, message: document.failureMessage } : null,
        job,
        updatedAt: document.updatedAt.toISOString(),
      },
      { requestId: context.requestId, headers: { 'Cache-Control': 'no-store' } },
    );
  },
  { workspace: { minRole: 'viewer' } },
);
