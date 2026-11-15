import { legalConfig } from '@/config/legal';
import type { LegalDocument } from './types';

export const securityPage: LegalDocument = {
  slug: 'security',
  title: 'Security at ParsePilot',
  subtitle:
    'The controls implemented in this application, the limitations we are aware of, and how to report a vulnerability.',
  version: legalConfig.versions.security.version,
  effectiveDate: legalConfig.versions.security.effectiveDate,
  lastUpdated: legalConfig.versions.security.lastUpdated,
  summary: [
    'This page describes security features that exist in the deployed codebase. It deliberately avoids claims we cannot verify, including audits, certifications and penetration tests we have not commissioned.',
    'Uploaded documents are private. They are stored under random keys in private object storage and served only through short-lived signed links issued after a server-side workspace authorisation check.',
    'If you believe you have found a vulnerability, please report it to the security contact. Do not test against production systems without written authorisation.',
  ],
  sections: [
    {
      id: 'data-protection',
      title: 'Data Protection',
      clauses: [
        { lead: 'In transit.', text: 'All application traffic is served over HTTPS/TLS in production. Security headers include HSTS, a restrictive Content-Security-Policy, frame-ancestors none, nosniff and a strict referrer policy.' },
        { lead: 'At rest.', text: 'PostgreSQL and object storage are expected to provide encryption at rest at the infrastructure layer. When S3-compatible storage is used, uploads request server-side encryption (AES-256). Local development filesystem storage is not encrypted at rest and must not be used in production.' },
        { lead: 'Credentials.', text: 'Database credentials, signing secrets, the internal service token and provider API keys are supplied through environment variables or the hosting provider\'s secret store. They are not committed to source control and are never sent to the browser.' },
        { lead: 'No claim of certification.', text: 'ParsePilot does not claim SOC 2, ISO 27001, PCI DSS certification or any other audit status. Card data is handled by Stripe; we do not store card numbers.' },
      ],
    },
    {
      id: 'access-control',
      title: 'Access Control',
      clauses: [
        { lead: 'Authentication.', text: 'Accounts use email and password. Passwords are hashed with scrypt using a per-user random salt and compared in constant time. Sessions are opaque 256-bit tokens; only a SHA-256 hash is stored in the database, so a database read does not yield usable session tokens.' },
        { lead: 'Sessions.', text: 'Session cookies are HttpOnly, SameSite=Lax, and Secure in production. Sessions expire after a configured period, are revoked on sign-out and password reset, and can be revoked individually from Privacy & Data settings.' },
        { lead: 'Workspace authorization.', text: 'Every document, job, export and billing read is scoped by workspace membership resolved server-side. A workspace identifier supplied by the client is validated against the authenticated user\'s memberships; it is never trusted on its own.' },
        { lead: 'Roles.', text: 'Workspace roles are owner, admin, member and viewer. Read operations require viewer, document mutations require member, billing and workspace administration require owner or admin. The API wrapper enforces the minimum role for each route.' },
        { lead: 'CSRF.', text: 'Cookie-authenticated state-changing requests require a matching double-submit CSRF token and a same-origin check. Requests authenticated with a bearer token are not cookie-driven and are therefore not vulnerable to CSRF.' },
        { lead: 'Rate limiting.', text: 'Authentication, upload, export, download-link and privacy endpoints are rate limited per IP or per user. Redis provides shared counters across instances; a process-local fallback exists for development only.' },
      ],
    },
    {
      id: 'document-security',
      title: 'Document Security',
      clauses: [
        { lead: 'Private storage.', text: 'Objects are stored in a private bucket under workspace-prefixed random keys. The original filename is stored only as metadata and is never used to address the object.' },
        { lead: 'Upload validation.', text: 'File type is detected from magic bytes rather than the extension or client-supplied content type. Size limits and plan limits are enforced before storage. PDFs containing JavaScript, launch actions, embedded files, XFA forms or encryption are quarantined and rejected.' },
        { lead: 'Signed access.', text: 'Downloads use HMAC-signed capability URLs that expire after five minutes by default. Creating one requires an authenticated workspace member; the route returns only the requested object and never lists keys.' },
        { lead: 'Processing isolation.', text: 'Document processing runs in a separate Python service and worker. The worker authenticates to the web application with a shared internal token, claims jobs atomically, and reports results back through narrow internal endpoints.' },
        { lead: 'Deletion.', text: 'Deleting a document revokes access immediately, cancels active jobs, records the storage key in a deletion record, and removes the object and dependent rows through the retention worker. Failed deletions are retried and tracked.' },
        { lead: 'Malware scanning limitation.', text: 'The upload quarantine is content-pattern based, not a full antivirus engine. A production deployment handling untrusted public uploads should add a malware scanner before processing; the internal interface is designed so that this can be inserted before the job is queued.' },
      ],
    },
    {
      id: 'infrastructure-security',
      title: 'Infrastructure Security',
      clauses: [
        { lead: 'Database.', text: 'PostgreSQL is the system of record with foreign keys, unique constraints and workspace indexes. Access is restricted to the application and worker using dedicated credentials.' },
        { lead: 'Redis.', text: 'Redis carries queue state, rate limits and caches only. It does not hold authoritative business records and contains no document content.' },
        { lead: 'Environment separation.', text: 'Development, test and production are separate configurations. Production requires unique secrets, object storage and Redis; the readiness endpoint fails when a required dependency is missing.' },
        { lead: 'Observability.', text: 'Structured JSON logs include request and job correlation IDs, durations, retry counts and error categories. Document text and field values are excluded by a redaction layer. Health and readiness endpoints expose dependency status without configuration details.' },
        { lead: 'Backups.', text: 'Database backups and object-storage versioning/backups are expected at the infrastructure layer. The documented procedure requires a restore rehearsal before launch; no backup capability is claimed here unless it has actually been configured by the operator.' },
        { lead: 'Dependencies.', text: 'Dependencies are pinned in lockfiles. Operators should run dependency vulnerability scanning in CI; this repository documents the command but does not claim continuous scanning is enabled.' },
      ],
    },
    {
      id: 'ai-transparency',
      title: 'AI Processing Transparency',
      clauses: [
        { lead: 'What is sent.', text: 'When an external AI extraction provider is configured, extracted document text is sent to that provider to produce structured fields. The original file is not sent unless a deployment explicitly configures a provider that requires it.' },
        { lead: 'Where to verify.', text: 'The subprocessors page identifies the provider and links to its documentation. It must be completed by the operator with verified retention and training terms before launch; this page intentionally does not assert provider-specific guarantees that have not been checked.' },
        { lead: 'No training on customer data.', text: 'ParsePilot does not train models on customer documents or extracted data. External providers operate under their own terms; a provider that cannot contractually exclude training must not be enabled.' },
        { lead: 'Prompt injection.', text: 'Document text is treated strictly as data. The extraction model receives a fixed schema and explicit instructions not to follow instructions found in the document. Output is schema-constrained and validated; no document content is executed.' },
        { lead: 'Human review.', text: 'Low-confidence fields, missing required values and arithmetic inconsistencies are flagged. The dashboard routes affected documents to needs review rather than presenting extraction as verified fact.' },
      ],
    },
    {
      id: 'vulnerability-reporting',
      title: 'Vulnerability Reporting',
      clauses: [
        { lead: 'Contact.', text: `Report suspected vulnerabilities to ${legalConfig.securityEmail}. If encrypted communication is required, request a key in your first message without including exploit details.` },
        { lead: 'What to include.', text: 'A description of the issue, affected functionality, reproduction steps using synthetic data, and an impact assessment. Do not include real customer documents, personal data or credentials.' },
        { lead: 'Authorisation.', text: 'Do not test against production systems, attempt to access other users\' data, run denial-of-service tests, or use social engineering. Testing without written authorisation may violate law and these Terms.' },
        { lead: 'Our commitment.', text: 'We will acknowledge reports where possible, investigate in good faith, and keep you informed of remediation progress. We do not currently operate a paid bounty programme and will not imply one exists.' },
      ],
    },
    {
      id: 'security-updates',
      title: 'Security Updates',
      clauses: [
        { lead: 'Documentation review.', text: `This security documentation was last reviewed on ${legalConfig.securityReviewDate}.` },
        { lead: 'Security contact.', text: `${legalConfig.securityEmail} — this is a placeholder until the operator supplies a monitored mailbox.` },
        { lead: 'Published notices.', text: 'No security advisories have been published for this deployment. Any future advisory will be listed here; the absence of a notice is not a guarantee that no incident has occurred.' },
        { lead: 'Incident procedure.', text: 'An internal incident procedure covers identification, severity classification, containment, investigation, recovery, customer communication and post-incident review. Incident records are internal and are not published.' },
        { lead: 'Legal review.', text: 'This page requires legal and security review before it is relied upon in customer contracts. Statements here describe implementation intent and must be verified against the deployed environment.' },
      ],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial security documentation based on implemented controls. Certifications, audits and backup configuration are explicitly not claimed.' },
  ],
  related: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/subprocessors', label: 'Subprocessors' },
    { href: '/data-processing', label: 'Data Processing Agreement' },
  ],
};
