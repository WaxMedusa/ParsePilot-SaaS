import { legalConfig } from '@/config/legal';
import type { LegalDocument } from './types';

export const acceptableUsePolicy: LegalDocument = {
  slug: 'acceptable-use',
  title: 'Acceptable Use Policy',
  subtitle: 'What you may and may not do with ParsePilot, including the documents you upload.',
  version: legalConfig.versions.acceptableUse.version,
  effectiveDate: legalConfig.versions.acceptableUse.effectiveDate,
  lastUpdated: legalConfig.versions.acceptableUse.lastUpdated,
  summary: [
    'This policy protects the service, our customers and the people whose information appears in uploaded documents. It forms part of the Terms of Service.',
    'The short version: upload documents you are entitled to process, do not attack the service, and do not use it to build a competing extraction engine from our internal interfaces.',
  ],
  sections: [
    {
      id: 'prohibited-content',
      title: 'Prohibited Content',
      clauses: [
        'You must not upload or process content that is unlawful, infringing, or that you do not have the right to process. This includes documents obtained without authorisation and documents whose processing violates a confidentiality obligation.',
        'You must not upload malware, exploit documents, documents designed to execute code, or files intended to probe the parser, OCR engine or extraction model.',
        'You must not use the service to process special category data (such as health records or government identifiers) unless you have a lawful basis and have assessed that the service is appropriate for that data.',
        'You must not upload content that sexualises minors, incites violence, or is subject to trade sanctions or export-control restrictions.',
      ],
    },
    {
      id: 'prohibited-activities',
      title: 'Prohibited Activities',
      clauses: [
        'Do not attempt to access another workspace, document, export or billing record, or to bypass authentication, authorisation, rate limits or size limits.',
        'Do not probe, scan or test the vulnerability of the service without written authorisation. Authorised testing must use synthetic data and must not affect other customers.',
        'Do not reverse engineer the extraction schema, prompts or internal APIs in order to build a competing product, or resell access to the service without an agreement.',
        'Do not use the service to send unsolicited bulk communications, to build advertising profiles, or to conduct surveillance of individuals.',
        'Do not interfere with the service through denial-of-service attacks, resource exhaustion, automated account creation, or attempts to overwhelm the job queue.',
      ],
    },
    {
      id: 'document-handling',
      title: 'Document Handling',
      clauses: [
        'You are responsible for ensuring that documents containing personal information were collected and are processed lawfully, and for providing any required notices to the individuals concerned.',
        'You must configure retention and workspace membership in a way that matches your own obligations and remove access for people who no longer need it.',
        'You must not attempt to use document content to instruct, manipulate or jailbreak extraction models. Documents are treated as data, and any attempt to alter system behaviour through document content is a breach of this policy.',
        'You must review extracted values before using them for payments, accounting, tax or regulatory purposes.',
      ],
    },
    {
      id: 'security-testing',
      title: 'Security Testing',
      clauses: [
        'Security research is welcome when coordinated responsibly. Contact the security team before testing, describe the scope, and use your own account and synthetic documents.',
        'Testing must not involve real customer data, social engineering, physical access attempts, or actions that degrade service for others.',
        'We may withdraw authorisation at any time if testing exceeds the agreed scope or creates risk.',
        'Report findings to the security contact. Do not publish details before a fix has been made available and a disclosure timeline has been agreed in good faith.',
      ],
    },
    {
      id: 'enforcement',
      title: 'Enforcement',
      clauses: [
        'We may investigate suspected breaches using audit logs, job records and request metadata. We do not routinely read document contents; investigation access is limited to what is necessary.',
        'We may remove content, suspend processing, restrict features or terminate accounts where a breach creates legal, security or operational risk. Where practical we will give notice and an opportunity to remedy.',
        'Serious breaches may be reported to law enforcement where required or appropriate.',
        'You are responsible for claims and costs arising from your breach of this policy, as described in the Terms of Service.',
      ],
    },
    {
      id: 'reporting',
      title: 'Reporting Abuse',
      clauses: [
        `Report abuse, malicious documents or impersonation to ${legalConfig.contactEmail}. Include enough detail to locate the account or document without sending us sensitive content.`,
        `For security vulnerabilities use ${legalConfig.securityEmail} instead.`,
        'We aim to acknowledge reports promptly and to act proportionately. We cannot discuss enforcement action against another customer with you.',
      ],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial draft. Contact addresses remain placeholders until the operator supplies monitored mailboxes.' },
  ],
  related: [
    { href: '/terms', label: 'Terms of Service' },
    { href: '/security', label: 'Security' },
    { href: '/privacy', label: 'Privacy Policy' },
  ],
};
