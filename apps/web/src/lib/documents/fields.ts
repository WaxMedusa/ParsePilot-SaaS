/**
 * Canonical extraction field definitions and normalisation rules shared by the
 * API, the UI field editor and the export builder. Original extracted values
 * are preserved verbatim; normalisation never overwrites them.
 */

export type FieldType = 'string' | 'date' | 'currency' | 'decimal' | 'integer' | 'json';

export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  group: 'identity' | 'parties' | 'dates' | 'amounts' | 'payment' | 'line_items' | 'other';
  description?: string;
};

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  { key: 'document_title', label: 'Document title', type: 'string', group: 'identity' },
  { key: 'document_number', label: 'Document number', type: 'string', group: 'identity' },
  { key: 'vendor_name', label: 'Vendor name', type: 'string', group: 'parties' },
  { key: 'vendor_address', label: 'Vendor address', type: 'string', group: 'parties' },
  { key: 'vendor_tax_id', label: 'Vendor tax ID', type: 'string', group: 'parties' },
  { key: 'customer_name', label: 'Customer name', type: 'string', group: 'parties' },
  { key: 'customer_address', label: 'Customer address', type: 'string', group: 'parties' },
  { key: 'issue_date', label: 'Issue date', type: 'date', group: 'dates' },
  { key: 'due_date', label: 'Due date', type: 'date', group: 'dates' },
  { key: 'currency', label: 'Currency', type: 'currency', group: 'amounts' },
  { key: 'subtotal', label: 'Subtotal', type: 'decimal', group: 'amounts' },
  { key: 'discount_amount', label: 'Discount', type: 'decimal', group: 'amounts' },
  { key: 'tax_amount', label: 'Tax amount', type: 'decimal', group: 'amounts' },
  { key: 'total_amount', label: 'Total amount', type: 'decimal', group: 'amounts' },
  { key: 'amount_paid', label: 'Amount paid', type: 'decimal', group: 'amounts' },
  { key: 'payment_terms', label: 'Payment terms', type: 'string', group: 'payment' },
  { key: 'purchase_order', label: 'Purchase order', type: 'string', group: 'payment' },
  { key: 'iban', label: 'IBAN', type: 'string', group: 'payment' },
  { key: 'line_items', label: 'Line items', type: 'json', group: 'line_items' },
];

export const FIELD_BY_KEY = new Map(FIELD_DEFINITIONS.map((definition) => [definition.key, definition]));
export const FIELD_KEYS = FIELD_DEFINITIONS.map((definition) => definition.key);

export function fieldLabel(key: string): string {
  return FIELD_BY_KEY.get(key)?.label ?? key.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Normalises a date to ISO 8601 (YYYY-MM-DD).
 * Day-first parsing is used for ambiguous numeric dates because the product's
 * first market formats dates day-first; ISO input is always unambiguous.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slashedYearFirst = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(value);
  if (slashedYearFirst) return isoDate(Number(slashedYearFirst[1]), Number(slashedYearFirst[2]), Number(slashedYearFirst[3]));

  const dotYearLast = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
  if (dotYearLast) {
    const first = Number(dotYearLast[1]);
    const second = Number(dotYearLast[2]);
    const year = Number(dotYearLast[3]);
    if (first > 12 && second <= 12) return isoDate(year, second, first);
    if (second > 12 && first <= 12) return isoDate(year, first, second);
    return isoDate(year, second, first); // day-first default
  }

  const named = /^(\d{1,2})[\s.-]+([A-Za-z]{3,9})[\s,.-]+(\d{4})$/.exec(value);
  if (named) {
    const month = MONTHS[named[2]!.toLowerCase()];
    if (month) return isoDate(Number(named[3]), month, Number(named[1]));
  }

  const namedFirst = /^([A-Za-z]{3,9})[\s.-]+(\d{1,2})[\s,.-]+(\d{4})$/.exec(value);
  if (namedFirst) {
    const month = MONTHS[namedFirst[1]!.toLowerCase()];
    if (month) return isoDate(Number(namedFirst[3]), month, Number(namedFirst[2]));
  }

  return null;
}

// ---------------------------------------------------------------------------
// Currency & decimals
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR',
  'CHF': 'CHF', 'kr': 'SEK', 'R$': 'BRL', 'A$': 'AUD', 'C$': 'CAD',
};

const ISO_CURRENCY = /^[A-Za-z]{3}$/;

export function normalizeCurrency(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (ISO_CURRENCY.test(value)) return value.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[value];
  if (symbol) return symbol;
  for (const [token, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (value.includes(token)) return code;
  }
  const codeMatch = /[A-Za-z]{3}/.exec(value);
  return codeMatch ? codeMatch[0].toUpperCase() : null;
}

/**
 * Parses a monetary/decimal string without floating-point arithmetic.
 * Handles "1,234.50", "1.234,50", "€ 1 234,50", "(1,234.50)" and trailing minus.
 */
export function normalizeDecimal(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let value = String(raw).trim();
  if (!value) return null;

  let negative = false;
  if (/^\(.*\)$/.test(value) || /^-/.test(value) || /-\s*$/.test(value)) negative = true;
  value = value.replace(/[()]/g, '').replace(/[-−]/g, '').replace(/[^0-9.,]/g, '');
  if (!value) return null;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  let decimalSeparator: ',' | '.' | null = null;

  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    const digitsAfter = value.length - lastComma - 1;
    const occurrences = (value.match(/,/g) ?? []).length;
    decimalSeparator = digitsAfter > 0 && digitsAfter <= 3 && !(occurrences > 1 && digitsAfter === 3) ? ',' : null;
  } else if (lastDot >= 0) {
    const digitsAfter = value.length - lastDot - 1;
    const occurrences = (value.match(/\./g) ?? []).length;
    decimalSeparator = digitsAfter > 0 && digitsAfter <= 3 && !(occurrences > 1 && digitsAfter === 3) ? '.' : null;
  }

  let integerPart = value;
  let fractionPart = '';
  if (decimalSeparator) {
    const index = value.lastIndexOf(decimalSeparator);
    integerPart = value.slice(0, index);
    fractionPart = value.slice(index + 1);
  }
  integerPart = integerPart.replace(/[.,]/g, '');
  fractionPart = fractionPart.replace(/[^0-9]/g, '');
  if (!integerPart && !fractionPart) return null;
  if (integerPart === '' ) integerPart = '0';

  const trimmedFraction = fractionPart.replace(/0+$/, '');
  const canonical = `${integerPart}.${trimmedFraction || '0'}`;
  if (canonical.replace('.', '').length > 18) return null;
  return negative ? `-${canonical}` : canonical;
}

export function decimalToCents(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = normalizeDecimal(value);
  if (!normalized) return null;
  const negative = normalized.startsWith('-');
  const [integer, fraction = '0'] = normalized.replace('-', '').split('.');
  const cents = Number(integer) * 100 + Number((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type IncomingField = {
  key: string;
  value: string | null;
  confidence?: number | null;
  type?: FieldType;
};

export type ValidatedField = IncomingField & {
  normalizedValue: string | null;
  type: FieldType;
  issues: string[];
};

export type ExtractionValidation = {
  fields: ValidatedField[];
  issues: string[];
  requiresReview: boolean;
  totalsConsistent: boolean | null;
};

const REQUIRED_FOR_REVIEW: string[] = ['vendor_name', 'issue_date', 'total_amount', 'currency'];

export function normalizeFieldValue(definition: FieldDefinition | undefined, raw: string | null): { value: string | null; issue?: string } {
  if (raw === null || raw === undefined || raw.trim() === '') return { value: null };
  switch (definition?.type) {
    case 'date': {
      const normalized = normalizeDate(raw);
      return normalized ? { value: normalized } : { value: null, issue: `Unrecognised date: "${raw.slice(0, 40)}"` };
    }
    case 'currency': {
      const normalized = normalizeCurrency(raw);
      return normalized ? { value: normalized } : { value: null, issue: `Unrecognised currency: "${raw.slice(0, 40)}"` };
    }
    case 'decimal': {
      const normalized = normalizeDecimal(raw);
      return normalized ? { value: normalized } : { value: null, issue: `Unrecognised amount: "${raw.slice(0, 40)}"` };
    }
    case 'integer': {
      const normalized = raw.replace(/[^0-9-]/g, '');
      return normalized && Number.isFinite(Number(normalized)) ? { value: String(Number(normalized)) } : { value: null, issue: 'Expected a whole number' };
    }
    default:
      return { value: raw.trim().slice(0, 4_000) };
  }
}

/**
 * Validates an extraction result. The extracted text is untrusted data: only
 * these structured values are persisted, and nothing is executed.
 */
export function validateExtraction(fields: IncomingField[]): ExtractionValidation {
  const issues: string[] = [];
  const seen = new Set<string>();
  const validated: ValidatedField[] = [];

  for (const field of fields) {
    if (!field.key || seen.has(field.key)) continue;
    seen.add(field.key);
    const definition = FIELD_BY_KEY.get(field.key);
    const type = definition?.type ?? field.type ?? 'string';
    const normalized = normalizeFieldValue(definition ?? { key: field.key, label: field.key, type, group: 'other' }, field.value);
    const fieldIssues: string[] = [];
    if (normalized.issue) fieldIssues.push(normalized.issue);
    if (field.confidence !== null && field.confidence !== undefined && (field.confidence < 0 || field.confidence > 1)) {
      fieldIssues.push('Confidence must be between 0 and 1');
    }
    validated.push({ ...field, type, normalizedValue: normalized.value, issues: fieldIssues });
    for (const issue of fieldIssues) issues.push(`${field.key}: ${issue}`);
  }

  const valueOf = (key: string) => validated.find((field) => field.key === key)?.normalizedValue ?? null;
  const subtotal = decimalToCents(valueOf('subtotal'));
  const discount = decimalToCents(valueOf('discount_amount'));
  const tax = decimalToCents(valueOf('tax_amount'));
  const total = decimalToCents(valueOf('total_amount'));
  // A discount is stored as a positive magnitude and reduces the net amount.
  const discountCents = discount ?? 0;
  let totalsConsistent: boolean | null = null;
  if (subtotal !== null && tax !== null && total !== null) {
    totalsConsistent = Math.abs(subtotal - discountCents + tax - total) <= 2;
    if (!totalsConsistent) {
      issues.push(
        discount === null
          ? 'subtotal + tax_amount does not equal total_amount'
          : 'subtotal - discount_amount + tax_amount does not equal total_amount',
      );
    }
  }
  if (total !== null && total >= 0) {
    if (subtotal !== null && subtotal - discountCents > total + 2) issues.push('subtotal exceeds total_amount');
    if (tax !== null && tax > total + 2) issues.push('tax_amount exceeds total_amount');
  }
  if (total !== null && total < 0) issues.push('total_amount is negative');

  const amountPaid = decimalToCents(valueOf('amount_paid'));
  if (amountPaid !== null && total !== null && amountPaid > total + 2) {
    issues.push('amount_paid exceeds total_amount');
  }

  const lineItemsRaw = valueOf('line_items');
  if (lineItemsRaw) {
    try {
      const parsed = JSON.parse(lineItemsRaw);
      if (Array.isArray(parsed)) {
        const lineTotal = parsed.reduce((sum, item) => {
          const amount = item && typeof item === 'object' ? decimalToCents(String((item as { amount?: unknown }).amount ?? '')) : null;
          return amount === null ? sum : sum + amount;
        }, 0);
        if (subtotal !== null) {
          // Line items may be listed before or after the discount is applied.
          const targets = discount === null ? [subtotal] : [subtotal, subtotal - discount];
          if (!targets.some((target) => Math.abs(lineTotal - target) <= 2)) {
            issues.push('line items do not add up to subtotal');
          }
        }
      }
    } catch {
      issues.push('line_items is not valid JSON');
    }
  }

  for (const key of REQUIRED_FOR_REVIEW) {
    if (!valueOf(key)) issues.push(`${fieldLabel(key)} is missing`);
  }
  const lowConfidence = validated.some((field) => field.confidence !== null && field.confidence !== undefined && field.confidence < 0.6);
  if (lowConfidence) issues.push('One or more fields were extracted with low confidence');

  return {
    fields: validated,
    issues,
    requiresReview: issues.length > 0,
    totalsConsistent,
  };
}

/** The value a user sees and exports: manual edit wins over extracted value. */
export function resolveFieldValue(field: { originalValue: string | null; normalizedValue: string | null; editedValue: string | null }): string | null {
  if (field.editedValue !== null && field.editedValue !== undefined && field.editedValue !== '') return field.editedValue;
  return field.normalizedValue ?? field.originalValue;
}
