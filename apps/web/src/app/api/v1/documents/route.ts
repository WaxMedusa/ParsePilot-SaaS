import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created, ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { parsePagination, parseSort, paginationMeta } from '@/lib/http/pagination';
import { listDocuments } from '@/lib/documents/repository';
import { createDocumentFromStoredUpload, createDocumentFromUpload } from '@/lib/documents/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORTABLE = ['createdAt', 'updatedAt', 'originalName', 'status', 'sizeBytes'] as const;

const completeUploadSchema = z.object({
  storageKey: z.string().trim().min(1).max(300),
  filename: z.string().trim().min(1).max(200),
});

type AcceptedUpload = Awaited<ReturnType<typeof createDocumentFromUpload>>;

function accepted(result: AcceptedUpload, requestId: string) {
  return created(
    {
      document: {
        id: result.document.id,
        originalName: result.document.originalName,
        status: 'queued',
        sizeBytes: result.document.sizeBytes,
        pageCount: result.document.pageCount,
        createdAt: result.document.createdAt.toISOString(),
      },
      job: { id: result.job.id, status: result.job.status, type: result.job.type },
      duplicateOf: result.duplicate ? { id: result.duplicate.id, name: result.duplicate.originalName } : null,
    },
    { requestId },
  );
}

export const GET = withApi(
  async (request, context) => {
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams, { defaultPageSize: 20, maxPageSize: 100 });
    const sort = parseSort(searchParams, SORTABLE, { field: 'createdAt', direction: 'desc' });
    const { documents, total } = await listDocuments({
      workspaceId: context.workspace!.id,
      skip: pagination.skip,
      take: pagination.take,
      status: searchParams.get('status') ?? undefined,
      kind: searchParams.get('kind') ?? undefined,
      search: searchParams.get('search')?.slice(0, 120) ?? undefined,
      sortField: sort.field,
      sortDirection: sort.direction,
    });
    return ok(documents, {
      meta: paginationMeta(total, pagination),
      requestId: context.requestId,
    });
  },
  { workspace: { minRole: 'viewer' }, rateLimit: { limit: 240, windowMs: 60_000, per: 'user' } },
);

export const POST = withApi(
  async (request, context) => {
    const contentType = request.headers.get('content-type') ?? '';

    // JSON body: the browser already uploaded the bytes to object storage and
    // asks the API to validate them and record the document.
    if (contentType.includes('application/json')) {
      const body = completeUploadSchema.parse(await request.json());
      const result = await createDocumentFromStoredUpload({
        workspaceId: context.workspace!.id,
        userId: context.auth!.user.id,
        storageKey: body.storageKey,
        filename: body.filename,
        correlationId: context.requestId,
        ipHash: context.ipHash,
      });
      return accepted(result, context.requestId);
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > 60 * 1024 * 1024) {
      throw ApiError.payloadTooLarge('The upload is too large');
    }
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw ApiError.badRequest('Expected a multipart/form-data upload');
    }
    const file = formData.get('file');
    if (!(file instanceof File)) throw ApiError.validation([{ path: 'file', message: 'Attach a file field named "file"' }]);

    const result = await createDocumentFromUpload({
      workspaceId: context.workspace!.id,
      userId: context.auth!.user.id,
      file,
      correlationId: context.requestId,
      ipHash: context.ipHash,
    });

    return accepted(result, context.requestId);
  },
  {
    workspace: { minRole: 'member' },
    rateLimit: { limit: 30, windowMs: 60 * 60 * 1000, per: 'user' },
  },
);
