import { legalConfig } from '@/config/legal';
import type { LegalDocument } from './types';

export const subprocessorPage: LegalDocument = {
  slug: 'subprocessors',
  title: 'Subprocessors',
  subtitle: 'External services that may process data for this ParsePilot deployment, and what each one receives.',
  version: legalConfig.versions.subprocessors.version,
  effectiveDate: legalConfig.versions.subprocessors.effectiveDate,
  lastUpdated: legalConfig.versions.subprocessors.lastUpdated,
  summary: [
    'This page lists the external services that the application can send data to. Entries marked "configuration-dependent" are only used when the deployment operator has enabled that provider; they are not automatically active.',
    'This is a transparency document, not an assertion that every provider has been contractually verified. Processing locations, retention periods and training terms must be confirmed by the operator and recorded here before launch.',
    'No provider is ever given access to private object storage directly. Documents are downloaded by the processing worker; only text extracted from the document may be sent to an extraction provider when one is configured.',
  ],
  sections: [
    {
      id: 'current-subprocessors',
      title: 'Provider List',
      clauses: [
        'The table below uses the following status labels: "Active" means the code integrates with the service and it is enabled by configuration; "Configuration-dependent" means the integration exists but is inactive unless the operator supplies credentials or enables it; "Self-hosted" means the component runs on the deployment\'s own infrastructure rather than a third party.',
        'Anything not listed here is not intentionally used to process customer data. Infrastructure providers must be filled in by the operator because they depend on where the deployment runs.',
      ],
      table: {
        columns: ['Provider', 'Service', 'Data processed', 'Processing purpose', 'Privacy documentation'],
        rows: [
          ['Stripe, Inc. — configuration-dependent', 'Payments and subscription billing', 'Billing contact details, customer and subscription identifiers, invoice and payment-failure metadata. Card details are handled by Stripe and are not stored by ParsePilot.', 'Processing payments, managing subscriptions and handling failed payments', 'https://stripe.com/privacy'],
          ['Configured AI extraction provider — configuration-dependent, must be verified', 'Structured field extraction', 'Text extracted from uploaded documents and the document type. Provider-specific retention and training terms have not been verified in this template.', 'Turning document text into structured fields', '[[REQUIRED: AI provider privacy documentation URL]]'],
          ['Configured object storage provider — deployment-dependent', 'Private file storage', 'Uploaded documents and generated export files, under random object keys', 'Durable private storage and signed downloads', '[[REQUIRED: object storage provider privacy documentation URL]]'],
          ['Configured PostgreSQL provider — deployment-dependent', 'Primary database', 'Account and workspace records, document metadata, extracted field values, job records, usage and billing state', 'Authoritative business data storage', '[[REQUIRED: database provider privacy documentation URL]]'],
          ['Configured Redis provider — deployment-dependent', 'Queue and transient coordination', 'Job identifiers, job payload references, rate-limit counters. No document content.', 'Background job queue, retries and rate limiting', '[[REQUIRED: Redis provider privacy documentation URL]]'],
          ['Tesseract OCR — self-hosted', 'Optical character recognition', 'Page images generated from uploaded documents, processed on the deployment\'s own worker', 'Reading scanned pages that have no usable text layer', 'Not a third-party subprocessor when self-hosted'],
          ['Transactional email provider — not configured', 'Password reset and account notices', 'Email address and reset link, if an email provider is enabled', 'Delivering transactional email', '[[REQUIRED: email provider privacy documentation URL if one is enabled]]'],
          ['Error monitoring provider — not configured', 'Application diagnostics', 'Error identifiers, request correlation IDs and technical metadata. Document contents must never be sent.', 'Detecting and diagnosing production errors', '[[REQUIRED: monitoring provider privacy documentation URL if one is enabled]]'],
        ],
      },
    },
    {
      id: 'not-used',
      title: 'Services Explicitly Not Used',
      clauses: [
        'This codebase does not include analytics, advertising, session-replay, live-chat or CRM scripts on the application pages. If any of those are added, they must be listed here and gated behind cookie consent.',
        'No marketing email platform is integrated. No customer data is exported to a data warehouse or business-intelligence tool.',
        'ParsePilot does not sell data and does not share document content with advertising networks.',
      ],
    },
    {
      id: 'selection',
      title: 'Selection and Review',
      clauses: [
        'A provider may be enabled only if it is necessary for a feature, offers appropriate confidentiality and security commitments, and its data-use terms are acceptable for confidential business documents.',
        'The operator must record the verified retention period and training/use terms for each provider that receives document content, and review them when the provider changes its terms.',
        'Providers that cannot exclude training on customer data, or that retain content indefinitely, must not be used for extraction.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes to This List',
      clauses: [
        'We will update this page when a provider is added, removed or materially changed. Material changes affecting document content should be communicated to customers in advance where the DPA requires it.',
        'The version history below records changes to the published list. This page must be kept in sync with the deployment configuration; a mismatch means the page is wrong.',
        'The table is designed to be edited in one configuration file so that infrastructure changes can be reflected without rewriting the page.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      clauses: [
        `Questions or objections about a subprocessor can be sent to ${legalConfig.privacyEmail}. Security issues should go to ${legalConfig.securityEmail}.`,
        'Where a DPA is in place, objections will be handled under its subprocessor provisions.',
      ],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial list of integrated and configuration-dependent providers. Infrastructure and AI provider entries must be completed with verified details before launch.' },
  ],
  related: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/data-processing', label: 'Data Processing Agreement' },
    { href: '/security', label: 'Security' },
  ],
};
