import { describe, expect, it } from 'vitest';
import { normalizeCurrency, normalizeDate, normalizeDecimal, validateExtraction } from './fields';

describe('date normalisation', () => {
  it('accepts ISO, day-first and named dates', () => {
    expect(normalizeDate('2026-03-14')).toBe('2026-03-14');
    expect(normalizeDate('14/03/2026')).toBe('2026-03-14');
    expect(normalizeDate('14 Mar 2026')).toBe('2026-03-14');
    expect(normalizeDate('March 14, 2026')).toBe('2026-03-14');
  });

  it('rejects impossible calendar dates', () => {
    expect(normalizeDate('31/02/2026')).toBeNull();
    expect(normalizeDate('2026-13-01')).toBeNull();
    expect(normalizeDate('soon')).toBeNull();
  });
});

describe('currency and decimal normalisation', () => {
  it('maps symbols and ISO codes', () => {
    expect(normalizeCurrency('$')).toBe('USD');
    expect(normalizeCurrency('eur')).toBe('EUR');
    expect(normalizeCurrency('£')).toBe('GBP');
    expect(normalizeCurrency('')).toBeNull();
  });

  it('handles European and US money formats without float drift', () => {
    expect(normalizeDecimal('1,234.50')).toBe('1234.5');
    expect(normalizeDecimal('1.234,50')).toBe('1234.5');
    expect(normalizeDecimal('(1,234.50)')).toBe('-1234.5');
    expect(normalizeDecimal('1200-')).toBe('-1200.0');
    expect(normalizeDecimal('not money')).toBeNull();
  });
});

describe('extraction validation', () => {
  it('flags inconsistent totals for review', () => {
    const result = validateExtraction([
      { key: 'vendor_name', value: 'Acme', confidence: 0.9 },
      { key: 'issue_date', value: '2026-03-14', confidence: 0.9 },
      { key: 'currency', value: 'USD', confidence: 0.9 },
      { key: 'subtotal', value: '1000.00', confidence: 0.9 },
      { key: 'tax_amount', value: '200.00', confidence: 0.9 },
      { key: 'total_amount', value: '1250.00', confidence: 0.9 },
    ]);
    expect(result.totalsConsistent).toBe(false);
    expect(result.requiresReview).toBe(true);
    expect(result.issues.join(' ')).toContain('does not equal');
  });

  it('passes a consistent extraction', () => {
    const result = validateExtraction([
      { key: 'vendor_name', value: 'Acme', confidence: 0.9 },
      { key: 'issue_date', value: '2026-03-14', confidence: 0.9 },
      { key: 'currency', value: 'USD', confidence: 0.9 },
      { key: 'subtotal', value: '1000.00', confidence: 0.9 },
      { key: 'tax_amount', value: '200.00', confidence: 0.9 },
      { key: 'total_amount', value: '1200.00', confidence: 0.9 },
    ]);
    expect(result.totalsConsistent).toBe(true);
    expect(result.requiresReview).toBe(false);
  });
});
