import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { getDataRequestDownload } from '@/lib/privacy/data-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (request, context) => {
    const result = await getDataRequestDownload(context.auth!.user.id, context.params.id);
    return ok(result, { requestId: context.requestId });
  },
  { auth: 'required' },
);
