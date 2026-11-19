import type { NextRequest } from 'next/server';
import { buildLiveExport } from '@/lib/exports/live';
import { readLiveWorkbookToken } from '@/lib/exports/live-token';
import { assertFormatAllowed } from '@/lib/exports/service';
import { ApiError } from '@/lib/http/errors';
import { errorResponse } from '@/lib/http/respond';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { getClientIp, getRequestId, hashIp } from '@/lib/http/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The permanent live workbook link. It carries no session, so Excel and Google
 * Sheets can fetch it directly; the signed token is the credential and the
 * workbook is rebuilt from the database on every request.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { token } = await context.params;
    const workspaceId = readLiveWorkbookToken(token);
    if (!workspaceId) throw ApiError.notFound('This live workbook link is not valid');

    const limit = await enforceRateLimit(
      `live-workbook:ip:${hashIp(getClientIp(request))}`,
      120,
      60 * 60 * 1000,
    );
    if (!limit.allowed) throw ApiError.rateLimited(limit.retryAfterSeconds);

    await assertFormatAllowed(workspaceId, 'xlsx');
    const result = await buildLiveExport(workspaceId);

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': 'attachment; filename="parsepilot-live.xlsx"',
        'Content-Length': String(result.buffer.byteLength),
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
