import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { ok, noContent } from '@/lib/http/respond';
import { getVendor, updateVendor, deleteVendor } from '@/lib/vendors/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  taxId: z.string().trim().max(100).optional().nullable(),
  paymentTerms: z.string().trim().max(200).optional().nullable(),
  defaultGlCode: z.string().trim().max(20).optional().nullable(),
  defaultDepartment: z.string().trim().max(100).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const GET = withApi(
  async (request, context) => {
    const vendor = await getVendor(context.params.id, context.workspace!.id);
    if (!vendor) return noContent({ requestId: context.requestId });
    return ok(vendor, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 120, windowMs: 60_000, per: 'user' } },
);

export const PATCH = withApi(
  async (request, context) => {
    const body = updateSchema.parse(await request.json());
    const vendor = await updateVendor(context.params.id, context.workspace!.id, body);
    return ok(vendor, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 30, windowMs: 60_000, per: 'user' } },
);

export const DELETE = withApi(
  async (request, context) => {
    await deleteVendor(context.params.id, context.workspace!.id);
    return noContent({ requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 30, windowMs: 60_000, per: 'user' } },
);