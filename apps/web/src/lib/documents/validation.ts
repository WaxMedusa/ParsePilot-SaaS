import { PDFDocument } from 'pdf-lib';
import { appConfig } from '../env';
import { ApiError } from '../http/errors';

/**
 * Upload validation. File extensions and the client-supplied MIME type are not
 * trusted: the detected type comes from magic bytes, then a lightweight
 * inspection quarantines documents with active content before any processing.
 */

export type SupportedMime = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/tiff' | 'image/webp';

const EXTENSIONS: Record<SupportedMime, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/tiff': 'tif',
  'image/webp': 'webp',
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** Detects a supported type from the file's magic bytes. */
export function detectMimeType(bytes: Uint8Array): SupportedMime | null {
  if (bytes.length < 12) return null;
  // %PDF- may occur within the first 1024 bytes of some generators.
  const head = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 1024))).toString('latin1');
  if (head.includes('%PDF-')) return 'application/pdf';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return 'image/tiff';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

/** File extension for a declared MIME type, used to build storage keys. */
export function extensionForMime(mime: string | null | undefined): string {
  if (!mime) return 'bin';
  return EXTENSIONS[mime as SupportedMime] ?? 'bin';
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'document';
  const cleaned = base
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return cleaned || 'document';
}

export type QuarantineInspection = { quarantined: boolean; reasons: string[] };

/**
 * Lightweight pre-processing inspection. PDFs containing JavaScript, launch
 * actions, embedded files or XFA forms are quarantined: ParsePilot never
 * executes document content and refuses documents designed to run code.
 * A production deployment should additionally place a real malware scanner in
 * front of this check (see docs/security.md).
 */
export function inspectForActiveContent(bytes: Uint8Array, mime: SupportedMime): QuarantineInspection {
  const reasons: string[] = [];

  if (mime === 'application/pdf') {
    const text = Buffer.from(bytes).toString('latin1');
    if (/\/JavaScript\b/.test(text)) reasons.push('PDF contains JavaScript');
    if (/\/JS\b/.test(text)) reasons.push('PDF contains script actions');
    if (/\/Launch\b/.test(text)) reasons.push('PDF contains a launch action');
    if (/\/EmbeddedFile\b/.test(text)) reasons.push('PDF contains embedded files');
    if (/\/XFA\b/.test(text)) reasons.push('PDF contains an XFA form');
    if (/\/Encrypt\b/.test(text)) reasons.push('PDF is encrypted');
  }

  return { quarantined: reasons.length > 0, reasons };
}

/**
 * Reads the real page tree instead of counting raw `/Type /Page` tokens. A
 * regex misses compressed object streams and can undercount valid PDFs, which
 * would let an upload bypass the plan page allowance.
 */
async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = pdf.getPageCount();
    if (!Number.isInteger(pages) || pages < 1) throw new Error('empty_pdf');
    return pages;
  } catch {
    throw ApiError.validation([
      { path: 'file', message: 'This PDF could not be read. Upload a valid, unencrypted PDF.' },
    ]);
  }
}

export type ValidatedUpload = {
  bytes: Uint8Array;
  mime: SupportedMime;
  extension: string;
  originalName: string;
  sizeBytes: number;
  checksumSha256: string;
  pageCount: number;
};

export async function validateUploadFile(input: {
  bytes: Uint8Array;
  filename: string;
  declaredMime?: string | null;
  maxBytes?: number;
}): Promise<ValidatedUpload> {
  const maxBytes = input.maxBytes ?? appConfig.maxUploadBytes;
  if (input.bytes.byteLength === 0) throw ApiError.badRequest('The uploaded file is empty');
  if (input.bytes.byteLength > maxBytes) {
    throw ApiError.payloadTooLarge(`Files must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller`);
  }

  const mime = detectMimeType(input.bytes);
  if (!mime) throw ApiError.unsupportedMediaType('Only PDF, PNG, JPEG, TIFF and WebP files are accepted');
  if (!appConfig.allowedMimeTypes.includes(mime)) {
    throw ApiError.unsupportedMediaType(`Files of type ${mime} are not enabled on this deployment`);
  }

  const inspection = inspectForActiveContent(input.bytes, mime);
  if (inspection.quarantined) {
    throw new ApiError(422, 'validation_failed', 'This document was quarantined by the upload security check', {
      details: { reasons: inspection.reasons },
    });
  }

  const pageCount = mime === 'application/pdf' ? await countPdfPages(input.bytes) : 1;

  const { createHash } = await import('node:crypto');
  const checksumSha256 = createHash('sha256').update(input.bytes).digest('hex');

  return {
    bytes: input.bytes,
    mime,
    extension: EXTENSIONS[mime],
    originalName: sanitizeFilename(input.filename),
    sizeBytes: input.bytes.byteLength,
    checksumSha256,
    pageCount,
  };
}
