import { NextResponse } from 'next/server';
import { buildOpenApiDocument } from '@/lib/api/openapi';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(buildOpenApiDocument(), {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/json',
    },
  });
}
