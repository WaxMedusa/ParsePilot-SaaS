'use client';

/**
 * Client-side image shrinking.
 *
 * Documents are re-encoded to WebP in the browser before they are uploaded, so
 * the bytes that reach object storage (and the bandwidth the user pays for)
 * are the small ones. Nothing here is a security boundary: the server still
 * detects the real type from magic bytes and re-checks every limit.
 */

export type OptimizeOptions = {
  /** Longest edge in pixels. Aspect ratio is preserved. */
  maxDimension?: number;
  /** WebP quality, 0–1. */
  quality?: number;
  /** Files at or below this size are left alone when already WebP. */
  skipUnderBytes?: number;
};

export type OptimizedImage = {
  file: File;
  originalBytes: number;
  optimizedBytes: number;
  /** True when a smaller WebP replaced the original. */
  changed: boolean;
};

const DEFAULT_MAX_DIMENSION = 2200;
const DEFAULT_QUALITY = 0.82;
const REENCODE_MIME = /^image\/(png|jpeg|webp)$/i;

function renamed(name: string, extension: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${extension}`;
}

async function toBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (some browsers refuse certain encodings).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('decode_failed'));
      image.src = url;
    });
    return image;
  } finally {
    // The <img> keeps its decoded pixels after the URL is revoked.
    URL.revokeObjectURL(url);
  }
}

function dimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  return { width, height };
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/webp', quality));
}

/** Re-encodes a PNG/JPEG/WebP upload as a smaller WebP, or returns it untouched. */
export async function optimizeImage(file: File, options: OptimizeOptions = {}): Promise<OptimizedImage> {
  const originalBytes = file.size;
  const unchanged: OptimizedImage = { file, originalBytes, optimizedBytes: originalBytes, changed: false };

  if (!REENCODE_MIME.test(file.type)) return unchanged;
  const skipUnder = options.skipUnderBytes ?? 120 * 1024;
  if (file.type === 'image/webp' && originalBytes <= skipUnder) return unchanged;

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await toBitmap(file);
  } catch {
    return unchanged;
  }

  try {
    const { width, height } = dimensions(source);
    if (!width || !height) return unchanged;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return unchanged;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await encode(canvas, quality);
    // Keep the original when the re-encode gains nothing (already optimised).
    if (!blob || blob.size >= originalBytes * 0.92) return unchanged;

    return {
      file: new File([blob], renamed(file.name, 'webp'), { type: 'image/webp', lastModified: Date.now() }),
      originalBytes,
      optimizedBytes: blob.size,
      changed: true,
    };
  } catch {
    return unchanged;
  } finally {
    if ('close' in source && typeof source.close === 'function') source.close();
  }
}

/** Percentage of bytes saved, for the upload card copy. */
export function savedPercent(originalBytes: number, optimizedBytes: number): number {
  if (originalBytes <= 0 || optimizedBytes >= originalBytes) return 0;
  return Math.round((1 - optimizedBytes / originalBytes) * 100);
}
