import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { parsePagination, parseSort, paginationMeta } from '@/lib/http/pagination';
import { listJobs, jobSummary } from '@/lib/jobs/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORTABLE = ['createdAt', 'updatedAt', 'availableAt', 'finishedAt', 'attempts'] as const;

export const GET = withApi(
  async (request, context) => {
    const searchParams = request.nextUrl.searchParams;
    const pagination = parsePagination(searchParams, { defaultPageSize: 25, maxPageSize: 100 });
    const sort = parseSort(searchParams, SORTABLE, { field: 'createdAt', direction: 'desc' });
    const { jobs, total } = await listJobs({
      workspaceId: context.workspace!.id,
      skip: pagination.skip,
      take: pagination.take,
      status: searchParams.get('status') ?? undefined,
      documentId: searchParams.get('documentId') ?? undefined,
      sortField: sort.field,
      sortDirection: sort.direction,
    });
    return ok(jobs.map(jobSummary), { meta: paginationMeta(total, pagination), requestId: context.requestId });
  },
  { workspace: { minRole: 'viewer' } },
);
