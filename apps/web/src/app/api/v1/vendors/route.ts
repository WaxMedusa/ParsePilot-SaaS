import { z } from 'zod';
import { withApi } from '@/lib/http/handler';
import { created, ok } from '@/lib/http/respond';
import { listVendors, createVendor } from '@/lib/vendors/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  taxId: z.string().trim().max(100).optional(),
  paymentTerms: z.string().trim().max(200).optional(),
  defaultGlCode: z.string().trim().max(20).optional(),
  defaultDepartment: z.string().trim().max(100).optional(),
  currency: z.string().length(3).optional(),
  aliases: z.array(z.string().trim().min(1)).optional(),
});

export const GET = withApi(
  async (request, context) => {
    const vendors = await listVendors(context.workspace!.id);
    return ok(vendors, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 120, windowMs: 60_000, per: 'user' } },
);

export const POST = withApi(
  async (request, context) => {
    const body = createSchema.parse(await request.json());
    const vendor = await createVendor({
      workspaceId: context.workspace!.id,
      ...body,
    });
    return created(vendor, { requestId: context.requestId });
  },
  { workspace: { minRole: 'admin' }, rateLimit: { limit: 30, windowMs: 60_000, per: 'user' } },
);