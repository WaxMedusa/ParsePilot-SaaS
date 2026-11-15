import { legalConfig } from '@/config/legal';
import { retentionSummary } from '@/config/retention';
import type { LegalDocument } from './types';

export const privacyPolicy: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  subtitle:
    'How ParsePilot collects, processes, stores and deletes information — including the contents of documents you upload.',
  version: legalConfig.versions.privacy.version,
  effectiveDate: legalConfig.versions.privacy.effectiveDate,
  lastUpdated: legalConfig.versions.privacy.lastUpdated,
  summary: [
    `${legalConfig.productName} is operated by ${legalConfig.legalEntityName}. This policy explains what we collect, why we collect it, where it is processed, how long it is kept, who may receive it, and how you can have it deleted.`,
    'Uploaded documents may contain personal information about your customers, suppliers and employees. We treat those documents as confidential business data and process them only to provide the service you have asked for.',
    'We do not sell personal information. We do not use your documents to train machine-learning models. Where an external AI provider is configured for extraction, document text is sent to that provider so it can return structured fields; the provider and the categories of data involved are listed on the subprocessors page.',
  ],
  sections: [
    {
      id: 'introduction',
      title: 'Introduction',
      clauses: [
        { lead: 'Who we are.', text: `${legalConfig.legalEntityName} ("${legalConfig.productName}", "we", "us") provides a document data extraction service. Our registered address is ${legalConfig.businessAddress}. Our privacy contact is ${legalConfig.privacyEmail}.` },
        { lead: 'Scope.', text: 'This policy applies to our website, the ParsePilot application, our API, and any support or sales interaction we have with you. It does not apply to third-party websites or services that we do not control.' },
        { lead: 'Roles.', text: 'For account data, we act as a data controller. For personal information contained inside documents that a business customer uploads, the customer is normally the controller and we act as a processor. Where we act as a processor, the Data Processing Agreement governs that processing.' },
        { lead: 'Your responsibilities.', text: 'You are responsible for having a lawful basis to upload documents containing other people\'s personal information, and for configuring retention that matches your own obligations.' },
      ],
    },
    {
      id: 'information-we-collect',
      title: 'Information We Collect',
      clauses: [
        { lead: 'Account information.', text: 'Your name (optional), email address, password hash and account timestamps. We never store your password in plain text; it is hashed with scrypt.' },
        { lead: 'Workspace information.', text: 'Workspace name, slug, plan, membership roles, billing email if you provide one, and workspace-level settings such as retention configuration.' },
        { lead: 'Uploaded documents.', text: 'The files you upload, their original filename (stored as metadata only), detected MIME type, byte size, SHA-256 checksum, page count and a randomly generated storage key. The file itself is stored in private object storage.' },
        { lead: 'Extracted document data.', text: 'The structured values produced by the processing pipeline — for example vendor name, document number, dates, currency, amounts and line items — together with confidence scores, normalised values, manual corrections and extraction version history.' },
        { lead: 'Usage information.', text: 'Pages processed, documents processed, export rows and the period those figures belong to. Usage is recorded in a ledger keyed to the processing job so retries cannot double-count pages.' },
        { lead: 'Technical logs.', text: 'Request paths, HTTP methods, status codes, durations, correlation and request identifiers, error categories, worker identifiers, and a keyed hash of the IP address rather than the address itself. We do not log document text or extracted field values.' },
        { lead: 'Billing information.', text: 'Plan, subscription status, Stripe customer and subscription identifiers, billing period and payment-failure timestamps. Card details are handled directly by Stripe and never reach our servers. We do not store full card numbers.' },
        { lead: 'Session information.', text: 'A hash of the session token, the browser user-agent, a keyed IP hash, creation time, last-used time and expiry.' },
        { lead: 'Cookie choices.', text: 'Your consent categories and the time you chose them, stored in a first-party cookie and, if you are signed in, associated with your account.' },
      ],
    },
    {
      id: 'uploaded-documents',
      title: 'Information Contained in Uploaded Documents',
      clauses: [
        { lead: 'What documents may contain.', text: 'Invoices, receipts, purchase orders and similar business records frequently contain names, business addresses, tax identifiers, bank details, signatures and contact information relating to your suppliers, customers or employees.' },
        { lead: 'How we handle it.', text: 'Document content is read by the processing pipeline solely to produce the structured fields you request. It is not used for advertising, profiling, model training, or any purpose unrelated to providing the service.' },
        { lead: 'Special category data.', text: 'Do not upload documents containing special category or highly sensitive personal information (for example health data or government identifiers) unless you have a lawful basis and have reviewed whether the service is appropriate for that data.' },
        { lead: 'Untrusted content.', text: 'Document text is treated as untrusted data. Instructions, prompts or code embedded in a document are never executed and are not followed by extraction models. We validate and structurally constrain the output before storing it.' },
      ],
    },
    {
      id: 'how-we-use-information',
      title: 'How We Use Information',
      clauses: [
        { lead: 'Providing the service.', text: 'Authenticating you, authorising workspace access, storing documents, queuing and executing processing jobs, displaying extracted data, applying corrections and generating exports.' },
        { lead: 'Protecting the service.', text: 'Rate limiting, abuse detection, duplicate-job prevention, upload validation, quarantine checks, audit logging and incident investigation.' },
        { lead: 'Billing and entitlements.', text: 'Determining your plan, enforcing page and file-size limits, processing subscription events received from Stripe, and handling failed payments.' },
        { lead: 'Support.', text: 'Responding to your requests. If you ask us to investigate a specific document, we will access it only with your instruction, and we prefer synthetic or redacted examples where the issue can be reproduced.' },
        { lead: 'Legal obligations.', text: 'Maintaining records required by tax, accounting, fraud-prevention or other applicable law, and responding to valid legal requests.' },
        { lead: 'What we do not do.', text: 'We do not sell personal information, we do not build advertising profiles from document data, and we do not use customer documents to train models.' },
      ],
    },
    {
      id: 'ai-processing',
      title: 'Document Processing and AI Providers',
      clauses: [
        { lead: 'Pipeline.', text: 'Documents are processed asynchronously by a separate Python worker. It extracts native PDF text first, runs OCR only for pages without a usable text layer, classifies the document, extracts structured fields, validates dates/currencies/totals and checks for duplicates.' },
        { lead: 'External AI providers.', text: 'If this deployment is configured with an external AI extraction provider, the text extracted from your document (not the original file unless the provider requires it) is transmitted to that provider to obtain structured output. The provider in use must be listed on the subprocessors page, together with its retention and data-use terms. Where no external provider is configured, extraction runs without transmitting document text to a third party.' },
        { lead: 'Model training.', text: 'We do not use your documents or extracted data to train models. External providers may have their own data-use terms; we only make a claim about a provider once it has been verified and documented on the subprocessors page. If a provider cannot meet the required terms, it must not be enabled.' },
        { lead: 'OCR.', text: 'OCR is performed with a self-hosted engine on our own infrastructure by default. If a third-party OCR provider is enabled, it must appear in the subprocessor list.' },
        { lead: 'Validation.', text: 'Extraction output is constrained to a fixed field schema, normalised, range-checked, arithmetically validated where possible, and assigned confidence values. Low-confidence or inconsistent results are routed to human review rather than silently accepted.' },
      ],
    },
    {
      id: 'storage-hosting',
      title: 'Data Storage and Hosting',
      clauses: [
        { lead: 'PostgreSQL.', text: 'PostgreSQL is the authoritative store for accounts, workspaces, document metadata, extraction versions, job records, usage and billing state. Access requires database credentials held in the deployment environment.' },
        { lead: 'Redis.', text: 'Redis carries queue state, rate-limit counters and short-lived caches. It is not used as the permanent record for business data.' },
        { lead: 'Object storage.', text: 'Uploaded files and generated exports are stored in private object storage under random keys. Buckets are not publicly readable and objects are served only through short-lived signed URLs created after an authorisation check.' },
        { lead: 'Local development.', text: 'In local development, files may be stored on a private filesystem path outside the web root. Production deployments must use private object storage.' },
        { lead: 'Locations.', text: `Processing and storage locations depend on the hosting and storage providers configured for the deployment: ${legalConfig.hostingRegionNote}. The subprocessors page is the authoritative list for the deployment you are using.` },
      ],
    },
    {
      id: 'retention',
      title: 'Data Retention',
      clauses: [
        { lead: 'Active documents.', text: 'Documents remain in your workspace until you delete them or your subscription and agreement end, subject to the retention settings configured for the workspace.' },
        { lead: 'Deleted documents.', text: `When you delete a document, access is revoked immediately and the record is marked for purge. The storage object and dependent extraction data are removed by the retention worker after a ${retentionSummary.softDeletedDocumentPurgeDays}-day window, which allows accidental deletions to be investigated.` },
        { lead: 'Exports.', text: `Generated CSV/XLSX exports and data-request bundles expire after ${retentionSummary.exportExpiryDays} days, after which the object is deleted by the retention sweep.` },
        { lead: 'Sessions and reset tokens.', text: `Sessions expire after ${retentionSummary.sessionAbsoluteDays} days by default and can be revoked earlier. Password reset tokens expire after one hour and are single-use.` },
        { lead: 'Audit logs.', text: `Sensitive-action audit records are retained for approximately ${retentionSummary.auditLogMonths} months, then deleted, unless a legal hold or active investigation requires longer retention.` },
        { lead: 'Billing records.', text: `Billing and tax records may be retained for up to ${retentionSummary.billingRecordYears} years where required by applicable law. These records do not contain document content.` },
        { lead: 'Backups.', text: `Encrypted backups are retained for up to ${retentionSummary.backupRetentionDays} days. Deleted data may persist in backups until the backup rotation completes; we do not promise instantaneous removal from backups.` },
        { lead: 'Retention configuration.', text: 'Deployment operators can configure retention windows within supported ranges. The values above describe the defaults documented for this deployment and must be kept consistent with the actual configuration.' },
      ],
    },
    {
      id: 'document-deletion',
      title: 'Document Deletion',
      clauses: [
        { lead: 'Deleting one document.', text: 'Workspace members with the appropriate role can delete a document from the document view. Access is revoked immediately across the UI, API and any previously issued links (which expire within minutes).' },
        { lead: 'Deleting a workspace.', text: 'A workspace owner can schedule workspace deletion from Privacy & Data settings. Deletion runs after a documented grace period, removes associated storage objects and database records, and is recorded in a deletion log.' },
        { lead: 'Deleting an account.', text: 'You can request account deletion from Privacy & Data settings after re-entering your password. Pending deletion can be cancelled during the grace period by contacting support. Workspaces you solely own are deleted with the account; if a workspace you own still has other members, deletion is blocked until ownership is transferred or the members are removed.' },
        { lead: 'What may remain.', text: 'We may retain limited billing records where legally required, anonymised audit entries, and residual copies in backups for the backup retention period. We do not retain document files for these purposes.' },
      ],
    },
    {
      id: 'sharing',
      title: 'Sharing and Disclosure',
      clauses: [
        { lead: 'Processors.', text: 'We share information with service providers that help us run the product: hosting, database, object storage, payment processing and, if configured, AI extraction and OCR. They act under contract and are listed on the subprocessors page.' },
        { lead: 'Within your workspace.', text: 'Members of your workspace can see documents according to their role. Workspace isolation is enforced server-side on every request.' },
        { lead: 'Legal requirements.', text: 'We may disclose information if required by law, a valid court order, or to protect the rights, safety and security of our users and the service. Where legally permitted, we will notify the account owner.' },
        { lead: 'Business transfer.', text: 'If we are acquired or merge with another organisation, information may transfer as part of that transaction, subject to this policy and applicable law.' },
        { lead: 'No sale.', text: 'We do not sell personal information or share it for cross-context behavioural advertising.' },
      ],
    },
    {
      id: 'third-parties',
      title: 'Third-Party Services',
      clauses: [
        { lead: 'Payments.', text: 'Stripe processes subscriptions and payment methods. Stripe receives billing contact information and transaction data; card details are entered in Stripe-hosted interfaces and are not stored by us.' },
        { lead: 'Extraction provider.', text: 'If enabled, the configured AI extraction provider receives extracted document text to return structured fields. The provider, its purpose and its documentation link are recorded on the subprocessors page.' },
        { lead: 'Infrastructure.', text: 'The deployment may use a managed PostgreSQL provider, a managed Redis provider and an S3-compatible object storage provider. These providers process data on our behalf under their own terms and data processing agreements.' },
        { lead: 'No current analytics provider.', text: 'This deployment does not currently load third-party analytics or advertising scripts. If that changes, the change will be reflected in the cookie policy and consent will be requested before any optional script loads.' },
        { lead: 'Your own integrations.', text: 'If you connect a third-party system to ParsePilot through exports or the API, that system processes data under your agreements, not ours.' },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies and Analytics',
      clauses: [
        { lead: 'Essential cookies.', text: 'We use a session cookie to keep you signed in, a CSRF token cookie to protect state-changing requests, and a cookie to remember your consent choices. These are necessary to provide the service and cannot be switched off while you use it.' },
        { lead: 'Optional cookies.', text: 'Optional analytics and marketing categories are off by default. No optional scripts are currently loaded. If we introduce them, they will only load after you grant consent for the relevant category.' },
        { lead: 'Your choice.', text: 'The consent banner offers Accept all, Reject optional and Customise with equal prominence. You can change your mind at any time through the cookie settings link in the footer.' },
        { lead: 'More detail.', text: 'The Cookie Policy lists the cookies we set, their purpose and their lifetime.' },
      ],
    },
    {
      id: 'security',
      title: 'Data Security',
      clauses: [
        { lead: 'Controls.', text: 'Encryption in transit with HTTPS/TLS, private object storage, hashed session tokens, scrypt password hashing, server-side workspace authorisation, rate limiting, upload content validation, signed short-lived download links and audit logging of sensitive actions.' },
        { lead: 'Access.', text: 'Access to production systems is restricted to personnel who need it. Credentials are supplied through environment configuration and are not committed to source control.' },
        { lead: 'No absolute guarantee.', text: 'No system is completely secure. We cannot guarantee that unauthorised access will never occur, but we investigate suspected incidents and notify affected customers where required by law or contract.' },
        { lead: 'More detail.', text: 'The Security page describes the implemented architecture, including the controls we do not claim.' },
      ],
    },
    {
      id: 'international-transfers',
      title: 'International Data Transfers',
      clauses: [
        { lead: 'Where processing happens.', text: 'Our service and its providers may process data in countries other than yours. The deployment configuration and provider list determine the locations involved.' },
        { lead: 'Safeguards.', text: 'Where personal data is transferred from a jurisdiction that requires safeguards, the operator must put an appropriate transfer mechanism in place with each provider (for example standard contractual clauses) and record it on the subprocessors page.' },
        { lead: 'Template status.', text: 'This section is part of a document awaiting legal review and completion of the deployment-specific details. Do not rely on it as a statement that a particular transfer mechanism is in place until it has been verified.' },
      ],
    },
    {
      id: 'your-rights',
      title: 'User Privacy Rights',
      clauses: [
        { lead: 'Rights.', text: 'Depending on your jurisdiction, you may have the right to access, correct, delete, restrict or object to processing, receive a portable copy of your data, and withdraw consent for optional processing.' },
        { lead: 'Exercising them.', text: 'Signed-in users can request an account data export, delete documents and request account deletion in Privacy & Data settings. You can also contact us using the details in this policy.' },
        { lead: 'Verification.', text: 'We verify your identity before fulfilling a request, usually by requiring you to be signed in and to confirm your password for destructive actions. We may ask for additional information where a request concerns data we cannot attribute to an account.' },
        { lead: 'Workspace data.', text: 'If your information was uploaded by a business customer, that customer is normally responsible for the request. We will support them in responding and will direct you to them where appropriate.' },
        { lead: 'Complaints.', text: `You may lodge a complaint with your local data protection authority. Our contact for privacy matters is ${legalConfig.privacyEmail}.` },
      ],
    },
    {
      id: 'children',
      title: "Children's Privacy",
      clauses: [
        { lead: 'Not for children.', text: 'ParsePilot is a business service and is not directed at children. Accounts require users to be at least 18 years old.' },
        { lead: 'Deletion.', text: 'If we learn that an account belongs to a child, we will disable it and delete the associated data, subject to legal retention requirements.' },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to This Policy',
      clauses: [
        { lead: 'Updates.', text: 'We may update this policy as the service or the law changes. The version number and last-updated date at the top of the page will change, and the version history records what changed.' },
        { lead: 'Material changes.', text: 'For material changes, we will take reasonable steps to notify account owners before the change takes effect, for example by email or an in-product notice.' },
        { lead: 'Draft status.', text: 'This version is a draft that requires completion of the deployment-specific details and legal review before it is used in a commercial launch.' },
      ],
    },
    {
      id: 'contact',
      title: 'Contact Information',
      clauses: [
        { lead: 'Privacy contact.', text: `${legalConfig.privacyEmail}. Data protection officer or EU representative: ${legalConfig.dpoContact}.` },
        { lead: 'Postal address.', text: legalConfig.businessAddress },
        { lead: 'General contact.', text: `${legalConfig.contactEmail}. Security reports: ${legalConfig.securityEmail}.` },
        { lead: 'Response time.', text: 'We aim to acknowledge privacy requests promptly and to respond within 30 days, or within the period required by applicable law, where we can verify your identity.' },
      ],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial draft prepared from the implemented data flows. Business identity, addresses and effective date remain placeholders pending completion and legal review.' },
  ],
  related: [
    { href: '/data-processing', label: 'Data Processing Agreement' },
    { href: '/subprocessors', label: 'Subprocessors' },
    { href: '/cookies', label: 'Cookie Policy' },
    { href: '/security', label: 'Security' },
  ],
};
