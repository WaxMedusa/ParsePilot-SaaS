/**
 * Profile avatars. Stored as private objects like every other upload; the
 * browser only ever receives an authenticated, versioned route.
 */
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
export const MAX_AVATAR_MB = 4;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const AVATAR_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

export function avatarExtension(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? null;
}

export function avatarStorageKey(userId: string, extension: string): string {
  const id = crypto.randomUUID().replace(/-/g, '');
  return `avatars/${userId}/${id}.${extension}`;
}

/** Versioned so a new picture replaces the previous one in the browser cache. */
export function avatarUrl(avatarUpdatedAt: Date | string | null | undefined): string | null {
  if (!avatarUpdatedAt) return null;
  const stamp = typeof avatarUpdatedAt === 'string' ? Date.parse(avatarUpdatedAt) : avatarUpdatedAt.getTime();
  return Number.isFinite(stamp) ? `/api/v1/profile/avatar?v=${stamp}` : null;
}
