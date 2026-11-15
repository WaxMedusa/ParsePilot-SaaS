export type Pagination = { page: number; pageSize: number; skip: number; take: number };

export type SortSpec = { field: string; direction: 'asc' | 'desc' };

export function parsePagination(searchParams: URLSearchParams, options?: { defaultPageSize?: number; maxPageSize?: number }): Pagination {
  const defaultPageSize = options?.defaultPageSize ?? 20;
  const maxPageSize = options?.maxPageSize ?? 100;
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const rawSize = Number.parseInt(searchParams.get('pageSize') ?? String(defaultPageSize), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1;
  const pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, maxPageSize) : defaultPageSize;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function parseSort(searchParams: URLSearchParams, allowed: readonly string[], fallback: SortSpec): SortSpec {
  const raw = searchParams.get('sort');
  const direction = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  if (raw && allowed.includes(raw)) return { field: raw, direction };
  return fallback;
}

export function paginationMeta(total: number, pagination: Pagination) {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    hasNextPage: pagination.page * pagination.pageSize < total,
    hasPreviousPage: pagination.page > 1,
  };
}

/** Builds a Prisma orderBy object from a validated sort specification. */
export function orderByFor(sort: SortSpec): Record<string, 'asc' | 'desc'> {
  return { [sort.field]: sort.direction };
}
