import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { validateUploadFile } from './validation';

async function pdfBytes(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) pdf.addPage();
  return pdf.save();
}

describe('PDF page counting', () => {
  it('reads the real page tree rather than counting raw page tokens', async () => {
    const result = await validateUploadFile({
      bytes: await pdfBytes(3),
      filename: 'three-pages.pdf',
      declaredMime: 'application/pdf',
    });
    expect(result.pageCount).toBe(3);
  });

  it('rejects a PDF whose page tree cannot be read', async () => {
    await expect(
      validateUploadFile({
        bytes: new TextEncoder().encode('%PDF-1.4\nnot a real pdf'),
        filename: 'broken.pdf',
        declaredMime: 'application/pdf',
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
