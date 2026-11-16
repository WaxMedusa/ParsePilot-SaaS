import { NextResponse } from 'next/server';
import { withApi } from '@/lib/http/handler';
import { getDocumentPreview } from '@/lib/documents/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ]/g, '_').slice(0, 150);
}

export const GET = withApi(
  async (_request, context) => {
    const file = await getDocumentPreview({
      documentId: context.params.id,
      workspaceId: context.workspace!.id,
    });
    const bytes = new Uint8Array(file.bytes);
    const contentType = /^(application\/pdf|image\/(png|jpeg|tiff|webp))$/i.test(file.mimeType)
      ? file.mimeType
      : 'application/octet-stream';

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `inline; filename="${safeFilename(file.originalName)}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "frame-ancestors 'self'",
      },
    });
  },
  { workspace: { minRole: 'viewer' }, rateLimit: { limit: 120, windowMs: 60_000, per: 'user' } },
);
