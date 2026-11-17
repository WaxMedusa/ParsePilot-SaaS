import { withInternalService } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { jobSummary } from '@/lib/jobs/service';
import { appConfig } from '@/lib/env';
import { resolveAiConfig } from '@/lib/ai/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withInternalService(async (request, context) => {
  const job = await prisma.processingJob.findUnique({
    where: { id: context.params.id },
    include: {
      document: {
        select: {
          id: true,
          originalName: true,
          storageKey: true,
          mimeType: true,
          sizeBytes: true,
          workspaceId: true,
          pageCount: true,
          checksumSha256: true,
        },
      },
      export: { select: { id: true, format: true, workspaceId: true } },
    },
  });
  if (!job) throw ApiError.notFound('Job not found');

  let documentContext: Record<string, unknown> | null = null;
  if (job.document) {
    const url = await getStorage().createDownloadUrl(
      job.document.storageKey,
      900,
      job.document.originalName,
      job.document.mimeType,
    );
    documentContext = {
      id: job.document.id,
      fileName: job.document.originalName,
      mimeType: job.document.mimeType,
      sizeBytes: job.document.sizeBytes,
      workspaceId: job.document.workspaceId,
      pageCount: job.document.pageCount,
      checksumSha256: job.document.checksumSha256,
      downloadUrl: url,
    };
  }

  // Only the processor (authenticated with INTERNAL_SERVICE_TOKEN) receives
  // the decrypted workspace key, so it can use the account's own provider.
  const ai = job.document ? await resolveAiConfig(job.workspaceId) : null;

  return ok(
    {
      job: jobSummary(job),
      document: documentContext,
      ai,
      export: job.export ? { id: job.export.id, format: job.export.format } : null,
      limits: {
        maxPagesPerDocument: 200,
        ocrMaxPages: 40,
        processorVersion: process.env.PROCESSOR_VERSION ?? '1',
        storageDriver: appConfig.storageDriver,
      },
    },
    { requestId: context.requestId },
  );
});
