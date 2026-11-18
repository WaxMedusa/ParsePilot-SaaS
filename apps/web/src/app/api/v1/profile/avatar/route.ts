import { NextResponse } from 'next/server';
import { withApi } from '@/lib/http/handler';
import { ok } from '@/lib/http/respond';
import { ApiError } from '@/lib/http/errors';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { avatarExtension, avatarStorageKey, avatarUrl, MAX_AVATAR_BYTES } from '@/lib/profile/avatar';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** Upload or replace the signed-in account's avatar (4 MB, PNG/JPEG/WebP). */
export const POST = withApi(
  async (request, context) => {
    const userId = context.auth!.user.id;
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_AVATAR_BYTES + 512 * 1024) {
      throw ApiError.payloadTooLarge('Avatars must be 4 MB or smaller');
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw ApiError.badRequest('Expected a multipart/form-data upload');
    }

    const file = formData.get('file');
    if (!(file instanceof File)) throw ApiError.validation([{ path: 'file', message: 'Attach an image field named "file"' }]);
    if (file.size === 0) throw ApiError.validation([{ path: 'file', message: 'That file is empty' }]);
    if (file.size > MAX_AVATAR_BYTES) throw ApiError.payloadTooLarge('Avatars must be 4 MB or smaller');

    const extension = avatarExtension(file.type);
    if (!extension) throw ApiError.validation([{ path: 'file', message: 'Use a PNG, JPEG or WebP image' }]);

    const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
    const key = avatarStorageKey(userId, extension);
    const bytes = new Uint8Array(await file.arrayBuffer());

    await getStorage().putObject(key, bytes, { contentType: file.type });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarKey: key, avatarUpdatedAt: new Date() },
      select: { avatarUpdatedAt: true },
    });

    if (previous?.avatarKey && previous.avatarKey !== key) {
      await getStorage()
        .deleteObject(previous.avatarKey)
        .catch((error) => logger.warn('avatar_replace_cleanup_failed', { message: error instanceof Error ? error.message : 'unknown' }));
    }

    return ok({ avatarUrl: avatarUrl(updated.avatarUpdatedAt) });
  },
  { auth: 'required', workspace: false, rateLimit: { limit: 20, windowMs: 60 * 60 * 1000, per: 'user' } },
);

/** The account's own avatar. Session-scoped, never public, never cached by shared caches. */
export const GET = withApi(
  async (_request, context) => {
    const user = await prisma.user.findUnique({ where: { id: context.auth!.user.id }, select: { avatarKey: true } });
    if (!user?.avatarKey) throw ApiError.notFound('No avatar set');

    const extension = user.avatarKey.split('.').pop() ?? 'png';
    try {
      const bytes = await getStorage().getObject(user.avatarKey);
      const body = new Uint8Array(bytes);
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': CONTENT_TYPE_BY_EXTENSION[extension] ?? 'image/png',
          'Content-Length': String(body.byteLength),
          'Cache-Control': 'private, no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        },
      });
    } catch (error) {
      logger.warn('avatar_read_failed', { message: error instanceof Error ? error.message : 'unknown' });
      throw ApiError.notFound('Avatar not found');
    }
  },
  { auth: 'required', workspace: false },
);

export const DELETE = withApi(
  async (_request, context) => {
    const userId = context.auth!.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
    await prisma.user.update({ where: { id: userId }, data: { avatarKey: null, avatarUpdatedAt: null } });
    if (user?.avatarKey) {
      await getStorage()
        .deleteObject(user.avatarKey)
        .catch((error) => logger.warn('avatar_delete_failed', { message: error instanceof Error ? error.message : 'unknown' }));
    }
    return ok({ avatarUrl: null });
  },
  { auth: 'required', workspace: false, rateLimit: { limit: 20, windowMs: 60 * 60 * 1000, per: 'user' } },
);
