import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { cancelAccountDeletion } from '@/lib/privacy/data-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApi(
  async (request, context) => {
    await cancelAccountDeletion(context.auth!.user.id);
    return ok({ cancelled: true }, { requestId: context.requestId });
  },
  { auth: 'required' },
);
