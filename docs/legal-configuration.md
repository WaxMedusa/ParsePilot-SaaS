# Legal configuration and launch gate

The product ships with real policy structure but **no invented business identity**. Every unknown value is an explicit
`[[REQUIRED: ...]]` placeholder. This is deliberate: a fake address, registration number, certification, DPO or email
address is worse than a visible gap.

## Pages

| Route | Content source |
| --- | --- |
| `/privacy` | `src/content/legal/privacy.ts` |
| `/terms` | `src/content/legal/terms.ts` |
| `/security` | `src/content/legal/security.ts` |
| `/data-processing` | `src/content/legal/data-processing.ts` |
| `/cookies` | `src/content/legal/cookies.ts` |
| `/acceptable-use` | `src/content/legal/acceptable-use.ts` |
| `/subprocessors` | `src/content/legal/subprocessors.ts` |
| `/contact` | `src/content/legal/contact.ts` |

All pages share a legal layout with a table of contents, stable section anchors, version history and print styles.

## Required values

Complete these in `apps/web/src/config/legal.ts`:

- registered legal entity name
- registered business address
- company registration number (if applicable)
- VAT number (if applicable)
- general contact email
- privacy contact email
- security contact email
- data protection officer or EU representative (if appointed)
- governing law jurisdiction
- courts of competent jurisdiction
- policy effective dates (privacy, terms, DPA, cookies, subprocessors, acceptable use, security)
- documented hosting regions
- `legalReviewCompleted: true`

Then replace every `[[REQUIRED: ...]]` in `src/content/legal/*.ts` that describes a business-specific fact. Do not
invent:

- certifications (SOC 2, ISO 27001, PCI DSS, HIPAA)
- audit reports or penetration-test results
- subprocessor names you have not engaged
- addresses, registration numbers, DPO details or email addresses
- breach-notification timelines beyond what counsel has approved

Update `src/content/legal/subprocessors.ts` to match the infrastructure actually used. If AI extraction is enabled, the
AI provider is a subprocessor and must be listed with its purpose, location and transfer mechanism. If it is disabled,
say so.

## Launch gate

Three layers enforce completion:

1. `src/instrumentation.ts` throws at production server start while placeholders remain. The web container will not
   become healthy.
2. `LEGAL_STRICT=1 npm run check:legal` exits non-zero (CI must set this for release builds). Without strict mode the
   script reports and succeeds so local development is not blocked.
3. `npm run verify` runs the non-strict report alongside design and type checks.

The `/contact` page explains why details are missing and does not fabricate a support channel. The cookie banner is
functional (Accept all / Reject optional / Customize) and persists preferences; it does not pretend a consent record
exists when optional cookies are rejected.

## Review checklist

- Entity, address and contact details match incorporation documents.
- Retention values in the legal text match `src/config/retention.ts`.
- Subprocessor list matches deployed infrastructure and AI configuration.
- International transfer mechanism is accurate for each subprocessor.
- Governing law and courts are correct.
- Policy version and effective date are updated.
- Legal review recorded (`legalReviewCompleted: true`).
- Print and mobile layouts checked; anchors and version history render.
