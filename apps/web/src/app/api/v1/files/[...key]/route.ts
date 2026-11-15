import { NextResponse, type NextRequest } from 'next/server';
import { verifyFilePayload } from '@/lib/storage/signing';
import { getStorage } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { appConfig } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
};

function contentTypeFor(key: string, declared?: string): string {
  if (declared && /^(application|image|text)\/[a-z0-9.+-]+$/i.test(declared)) return declared;
  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function safeFilename(name: string | undefined): string {
  return (name ?? 'document').replace(/[^\w.\- ]/g, '_').slice(0, 150);
}

/**
 * Private object access. The URL itself is a short-lived HMAC capability,
 * minted only after a workspace authorization check. Keys are never listed or
 * browsable; without a valid signature this route reveals nothing.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await context.params;
  const key = keyParts.join('/');
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: { code: 'unauthorized', message: 'Missing signature' } }, { status: 401 });

  const payload = verifyFilePayload(token);
  if (!payload || payload.key !== key) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Invalid or expired link' } }, { status: 403 });
  }
  if (request.nextUrl.searchParams.get('mode') === 'upload') {
    return NextResponse.json({ error: { code: 'bad_request', message: 'Use PUT for uploads' } }, { status: 405 });
  }

  try {
    const bytes = await getStorage().getObject(key);
    const contentType = contentTypeFor(key, payload.mime);
    const body = new Uint8Array(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `attachment; filename="${safeFilename(payload.name)}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    logger.warn('signed_file_not_found', { message: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: { code: 'not_found', message: 'File not found' } }, { status: 404 });
  }
}

/** Local storage only: workers upload generated export artefacts through this route. */
export async function PUT(request: NextRequest, context: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await context.params;
  const key = keyParts.join('/');
  const token = request.nextUrl.searchParams.get('token');
  const payload = token ? verifyFilePayload(token) : null;
  if (!payload || payload.key !== key || request.nextUrl.searchParams.get('mode') !== 'upload') {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Invalid upload link' } }, { status: 403 });
  }
  if (appConfig.storageDriver !== 'local') {
    return NextResponse.json({ error: { code: 'bad_request', message: 'Direct uploads are disabled' } }, { status: 400 });
  }

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > 50 * 1024 * 1024) {
    return NextResponse.json({ error: { code: 'payload_too_large', message: 'Upload too large' } }, { status: 413 });
  }
  await getStorage().putObject(key, body, { contentType });
  return NextResponse.json({ uploaded: true, sizeBytes: body.byteLength });
}
