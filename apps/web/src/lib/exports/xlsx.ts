import { zipSync, strToU8 } from 'fflate';

/**
 * Minimal OOXML writer for tabular exports.
 *
 * Keeping this local avoids shipping a large spreadsheet package (and its
 * transitive dependencies) in the web runtime. The output is a standard
 * single-sheet .xlsx workbook with a frozen header row, filters, column widths
 * and inline strings. Values are treated as data, never as formulas.
 */

export type XlsxCell = string | number | null | undefined;

export type BuildXlsxInput = {
  columns: string[];
  rows: Record<string, XlsxCell>[];
  numericColumns?: Iterable<string>;
  sheetName?: string;
  title?: string;
  generatedAt?: Date;
};

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function columnName(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeText(value: unknown): string {
  const text = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 32_000);
  // Prevent Excel from interpreting user-controlled data as a formula.
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function safeSheetName(value: string): string {
  return (value.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Documents').slice(0, 31);
}

function cellXml(ref: string, value: XlsxCell, numeric: boolean, style: number): string {
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"${style ? ` s="${style}"` : ''}/>`;
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : numeric && typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())
        ? Number(value)
        : null;

  if (numericValue !== null && Number.isFinite(numericValue)) {
    return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${numericValue}</v></c>`;
  }

  return `<c r="${ref}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    safeText(value),
  )}</t></is></c>`;
}

function workbookFiles(input: BuildXlsxInput): Record<string, Uint8Array> {
  const rows = input.rows;
  const columns = input.columns;
  const numericColumns = new Set(input.numericColumns ?? []);
  const lastColumn = columnName(Math.max(0, columns.length - 1));
  const lastRow = Math.max(1, rows.length + 1);
  const sheetName = safeSheetName(input.sheetName ?? 'Documents');
  const generatedAt = input.generatedAt ?? new Date();
  const generatedIso = generatedAt.toISOString();

  const header = columns
    .map((column, index) => cellXml(`${columnName(index)}1`, column, false, 1))
    .join('');
  const body = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const cells = columns
        .map((column, columnIndex) =>
          cellXml(`${columnName(columnIndex)}${rowNumber}`, row[column], numericColumns.has(column), 0),
        )
        .join('');
      return `<row r="${rowNumber}" ht="16" customHeight="1">${cells}</row>`;
    })
    .join('');

  const columnXml = columns
    .map((column, index) => {
      const width = Math.min(52, Math.max(12, column.length + 2));
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');

  const sheet = `${XML_DECL}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnXml}</cols>
  <sheetData>
    <row r="1" ht="21" customHeight="1">${header}</row>
    ${body}
  </sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;

  const contentTypes = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const packageRels = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const workbook = `${XML_DECL}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRels = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `${XML_DECL}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1F2937"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFEFFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const core = `${XML_DECL}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>ParsePilot</dc:creator>
  <cp:lastModifiedBy>ParsePilot</cp:lastModifiedBy>
  <dc:title>${escapeXml(input.title ?? 'ParsePilot live export')}</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${generatedIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${generatedIso}</dcterms:modified>
</cp:coreProperties>`;

  const app = `${XML_DECL}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ParsePilot</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${escapeXml(sheetName)}</vt:lpstr></vt:vector></TitlesOfParts>
</Properties>`;

  return {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(packageRels),
    'docProps/core.xml': strToU8(core),
    'docProps/app.xml': strToU8(app),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  };
}

export function buildXlsx(input: BuildXlsxInput): Buffer {
  return Buffer.from(zipSync(workbookFiles(input), { level: 6 }));
}
