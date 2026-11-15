/**
 * Central legal configuration.
 *
 * Every value marked with REQUIRED_PLACEHOLDER has NOT been supplied by the
 * business and must be completed by the operator before a commercial launch.
 * `scripts/check-legal-config.mjs` fails a production release while any
 * placeholder remains, and the legal pages render a visible notice instead of
 * inventing a business identity.
 *
 * Do not replace these placeholders with made-up company details, addresses,
 * registration numbers, certifications or audit claims.
 */

export const REQUIRED_PLACEHOLDER_PREFIX = '[[REQUIRED:';

export function placeholder(label: string): string {
  return `${REQUIRED_PLACEHOLDER_PREFIX} ${label}]]`;
}

export const legalConfig = {
  /** Registered legal entity name, exactly as it appears on incorporation documents. */
  legalEntityName: placeholder('registered legal entity name'),
  /** Trading name shown in the product. */
  productName: 'ParsePilot',
  /** Registered business address. Do not invent an address. */
  businessAddress: placeholder('registered business address'),
  /** Company registration / VAT identifiers if applicable. */
  registrationNumber: placeholder('company registration number if applicable'),
  vatNumber: placeholder('VAT number if applicable'),
  /** General contact address for support and legal notices. */
  contactEmail: placeholder('general contact email address'),
  /** Privacy requests / data subject requests. */
  privacyEmail: placeholder('privacy contact email address'),
  /** Security disclosure reports. */
  securityEmail: placeholder('security contact email address'),
  /** DPO or EU representative where one has been appointed. */
  dpoContact: placeholder('data protection officer or EU representative if appointed'),
  /** Governing law jurisdiction for the Terms of Service. */
  governingJurisdiction: placeholder('governing law jurisdiction'),
  /** Courts with exclusive jurisdiction. */
  governingCourts: placeholder('courts of competent jurisdiction'),
  /** Minimum age for account eligibility. */
  minimumAge: 18,
  /** Policy versions & effective dates. */
  versions: {
    privacy: { version: '1.0-draft', effectiveDate: placeholder('privacy policy effective date'), lastUpdated: '2026-11-15' },
    terms: { version: '1.0-draft', effectiveDate: placeholder('terms of service effective date'), lastUpdated: '2026-11-15' },
    dpa: { version: '1.0-draft', effectiveDate: placeholder('DPA effective date'), lastUpdated: '2026-11-15' },
    cookies: { version: '1.0-draft', effectiveDate: placeholder('cookie policy effective date'), lastUpdated: '2026-11-15' },
    subprocessors: { version: '1.0-draft', effectiveDate: placeholder('subprocessor list effective date'), lastUpdated: '2026-11-15' },
    acceptableUse: { version: '1.0-draft', effectiveDate: placeholder('acceptable use policy effective date'), lastUpdated: '2026-11-15' },
    security: { version: '1.0-draft', effectiveDate: placeholder('security page effective date'), lastUpdated: '2026-11-15' },
  },
  /** Set by the operator after legal review. Blocks the launch checklist. */
  legalReviewCompleted: false,
  /** Public security page review date (ISO). */
  securityReviewDate: '2026-11-15',
  /** Documented retention defaults, mirrored by src/config/retention.ts. */
  retentionSummary: {
    softDeletedDocumentPurgeDays: 30,
    exportExpiryDays: 7,
    sessionAbsoluteDays: 30,
    auditLogMonths: 24,
    backupRetentionDays: 30,
    billingRecordYears: 7,
  },
  /** Hosting / infrastructure region description — only verified facts. */
  hostingRegionNote: placeholder('documented hosting regions'),
} as const;

export type LegalConfig = typeof legalConfig;

export function listOutstandingPlaceholders(): string[] {
  const out: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      if (value.includes(REQUIRED_PLACEHOLDER_PREFIX)) out.push(`${path}: ${value}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) walk(entry, path ? `${path}.${key}` : key);
    }
  };
  walk(legalConfig, 'legalConfig');
  if (!legalConfig.legalReviewCompleted) out.push('legalConfig.legalReviewCompleted: legal review not marked complete');
  return out;
}

export const hasUnresolvedLegalPlaceholders = () => listOutstandingPlaceholders().length > 0;
