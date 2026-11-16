import { withApi } from '@/lib/http/handler';
import { buildLiveExport } from '@/lib/exports/live';
import { assertFormatAllowed } from '@/lib/exports/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const GET = withApi(
  async (request, context) => {
    await assertFormatAllowed(context.workspace!.id, 'xlsx');
    const result = await buildLiveExport(context.workspace!.id);
    const date = result.generatedAt.toISOString().slice(0, 10);
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="parsepilot-live-${date}.xlsx"`,
        'Content-Length': String(result.buffer.byteLength),
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'x-request-id': context.requestId,
      },
    });
  },
  { workspace: { minRole: 'viewer' }, rateLimit: { limit: 60, windowMs: 60 * 60 * 1000, per: 'user' } },
);
