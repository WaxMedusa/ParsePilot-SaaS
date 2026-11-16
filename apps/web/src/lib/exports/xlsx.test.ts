import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildXlsx } from './xlsx';

describe('buildXlsx', () => {
  it('writes a valid single-sheet xlsx package with typed numeric cells', () => {
    const buffer = buildXlsx({
      columns: ['vendor', 'total'],
      rows: [{ vendor: 'Acme', total: '110.00' }],
      numericColumns: ['total'],
    });

    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const files = unzipSync(new Uint8Array(buffer));
    expect(files['[Content_Types].xml']).toBeDefined();
    expect(files['xl/workbook.xml']).toBeDefined();

    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('Acme');
    expect(sheet).toContain('<v>110</v>');
    expect(sheet).toContain('state="frozen"');
  });

  it('neutralises spreadsheet formula prefixes', () => {
    const buffer = buildXlsx({
      columns: ['vendor'],
      rows: [{ vendor: '=HYPERLINK("https://example.test")' }],
    });
    const sheet = strFromU8(unzipSync(new Uint8Array(buffer))['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('&apos;=HYPERLINK');
  });
});
