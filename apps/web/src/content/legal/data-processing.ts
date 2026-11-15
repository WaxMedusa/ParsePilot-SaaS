import { legalConfig } from '@/config/legal';
import { retentionSummary } from '@/config/retention';
import type { LegalDocument } from './types';

export const dataProcessingAgreement: LegalDocument = {
  slug: 'data-processing',
  title: 'Data Processing Agreement',
  subtitle:
    'Template terms for business customers whose uploaded documents contain personal information processed by ParsePilot.',
  version: legalConfig.versions.dpa.version,
  effectiveDate: legalConfig.versions.dpa.effectiveDate,
  lastUpdated: legalConfig.versions.dpa.lastUpdated,
  summary: [
    'This Data Processing Agreement ("DPA") is a template. It must be reviewed by qualified legal counsel, completed with the operator\'s legal identity and transfer mechanisms, and executed by both parties before it is relied upon as a binding agreement.',
    'It applies when you use ParsePilot to process documents containing personal information and you are the controller (or a processor acting for another controller). It does not apply to account data for which ParsePilot is the controller.',
    'ParsePilot does not claim to be GDPR-certified or to have obtained any regulatory approval. Compliance depends on the completed agreement, the deployment configuration and the parties\' own obligations.',
  ],
  sections: [
    {
      id: 'roles',
      title: 'Roles of the Parties',
      clauses: [
        { lead: 'Customer as controller.', text: 'The Customer determines the purposes and means of processing personal information contained in uploaded documents and is the controller (or a processor acting on behalf of a controller).' },
        { lead: 'ParsePilot as processor.', text: `${legalConfig.legalEntityName} processes that personal information on the Customer\'s documented instructions to provide the service, and acts as a processor. Where ParsePilot determines the purposes and means of processing account data, it acts as a controller under its Privacy Policy.` },
        { lead: 'No joint controllership.', text: 'The parties do not intend to create a joint-controller relationship. Each party remains responsible for its own compliance obligations.' },
      ],
    },
    {
      id: 'instructions',
      title: 'Processing Instructions',
      clauses: [
        'The Customer instructs ParsePilot to process personal information only as necessary to provide the document extraction service, including storage, text extraction, OCR, classification, structured extraction, validation, duplicate detection, review, export and deletion.',
        'The Customer may provide additional written instructions that are consistent with the service. ParsePilot will notify the Customer if an instruction appears to infringe applicable data protection law and may suspend performance until the instruction is confirmed or amended.',
        'ParsePilot will not process personal information for its own purposes, sell it, or use it to train models. ParsePilot may process aggregated, de-identified operational metrics that do not identify the Customer or data subjects.',
        'ParsePilot will promptly inform the Customer if it is legally required to process personal information for another purpose, unless prohibited from doing so by law.',
      ],
    },
    {
      id: 'categories',
      title: 'Categories of Personal Information',
      clauses: [
        'The categories depend on the documents the Customer uploads. Typical categories are: names and contact details of customer or supplier personnel, business addresses, tax identifiers, bank account details, invoice and payment records, signatures and free-text notes.',
        'The Customer must not upload special category data unless the parties have agreed additional safeguards in writing and the processing is lawful.',
        'The volume of data depends on the number and size of documents uploaded and the Customer\'s retention settings.',
      ],
    },
    {
      id: 'data-subjects',
      title: 'Categories of Data Subjects',
      clauses: [
        'The data subjects may include the Customer\'s employees and contractors, its suppliers and their personnel, its own customers, and any other individuals mentioned in uploaded documents.',
        'The Customer is responsible for identifying the data subjects and ensuring that its notices and lawful bases cover the processing described in this DPA.',
      ],
    },
    {
      id: 'purposes',
      title: 'Processing Purposes',
      clauses: [
        'Extracting structured data from documents, validating and normalising it, detecting potential duplicates, presenting it for review, generating exports and maintaining the audit trail of edits.',
        'Securing the service, preventing abuse, maintaining job reliability and troubleshooting failures without accessing document content except where necessary.',
        'Billing and usage measurement, where pages processed are counted to apply plan limits. Billing records do not include document content.',
      ],
    },
    {
      id: 'confidentiality',
      title: 'Confidentiality',
      clauses: [
        'ParsePilot will ensure that personnel authorised to process personal information are bound by confidentiality obligations and receive appropriate training.',
        'Access to personal information is limited to personnel who need it to provide, secure or support the service, and to respond to the Customer\'s instructions.',
        'ParsePilot will not disclose personal information to third parties except as described in the subprocessor section, as instructed by the Customer, or as required by law.',
      ],
    },
    {
      id: 'security',
      title: 'Security Measures',
      clauses: [
        'ParsePilot maintains technical and organisational measures appropriate to the risk, including encryption in transit, hashed credentials, workspace-level authorisation, private object storage, short-lived signed downloads, upload validation, rate limiting, audit logging and background-job isolation.',
        'Measures are described in more detail on the Security page. ParsePilot may update them provided the overall level of protection is not materially reduced.',
        'The Customer is responsible for configuring its workspace, roles, retention and account security appropriately, and for reviewing extracted data before relying on it.',
        'Where the Customer requires specific measures not provided by the service, the parties must agree them in writing before processing begins.',
      ],
    },
    {
      id: 'subprocessors',
      title: 'Subprocessor Arrangements',
      clauses: [
        'The Customer authorises ParsePilot to engage subprocessors to provide hosting, database, object storage, payment processing and, where configured, AI extraction and OCR.',
        'ParsePilot will maintain a current list on the subprocessors page and impose data protection obligations on each subprocessor that are no less protective than those in this DPA, to the extent applicable to the service they provide.',
        'ParsePilot will give reasonable notice of a new subprocessor that processes document content and will allow the Customer to object on reasonable data protection grounds. If the parties cannot resolve the objection, the Customer may terminate the affected service.',
        'ParsePilot remains liable to the Customer for the performance of its subprocessors\' data protection obligations.',
      ],
    },
    {
      id: 'breach-notification',
      title: 'Data Breach Notification',
      clauses: [
        'ParsePilot will notify the Customer without undue delay after becoming aware of a personal data breach affecting the Customer\'s personal information.',
        'The notification will describe, to the extent known, the nature of the breach, the categories and approximate volume of data affected, the likely consequences, and the measures taken or proposed to address it and mitigate its effects.',
        'ParsePilot will cooperate with the Customer\'s reasonable requests for information and assistance with regulatory or data-subject notifications. The Customer is responsible for making notifications to regulators and data subjects unless the law requires ParsePilot to do so.',
        'Notification timelines and content must be reviewed for consistency with applicable law and with each party\'s incident response obligations.',
      ],
    },
    {
      id: 'data-subject-requests',
      title: 'Assistance with Data Subject Requests',
      clauses: [
        'Taking into account the nature of the processing, ParsePilot will provide reasonable assistance so that the Customer can respond to requests to access, rectify, erase, restrict or port personal information.',
        'The product provides account data export, document deletion, workspace deletion and per-session revocation. Requests relating to information inside documents should normally be directed to the Customer as controller.',
        'If ParsePilot receives a request directly concerning the Customer\'s documents, it will not respond substantively and will refer the requester to the Customer, unless legally required otherwise.',
      ],
    },
    {
      id: 'retention-deletion',
      title: 'Data Retention and Deletion',
      clauses: [
        `On termination or at the Customer\'s written instruction, ParsePilot will delete or return personal information, subject to legal retention obligations. Deleted documents become inaccessible immediately and are purged from primary storage after ${retentionSummary.softDeletedDocumentPurgeDays} days by default.`,
        `Generated exports expire after ${retentionSummary.exportExpiryDays} days. Audit records may be retained for up to ${retentionSummary.auditLogMonths} months. Backup retention is documented in the Privacy Policy and may delay complete removal from backups by up to ${retentionSummary.backupRetentionDays} days.`,
        'ParsePilot may retain records required by law, including billing and tax records, for the required period. Such records do not contain document content.',
        'The Customer is responsible for exporting data it needs before deletion. ParsePilot is not liable for data deleted at the Customer\'s instruction.',
      ],
    },
    {
      id: 'audit',
      title: 'Audit and Documentation',
      clauses: [
        'ParsePilot will make available information reasonably necessary to demonstrate compliance with this DPA, including this documentation, the security page and the subprocessor list.',
        'ParsePilot will allow for audits, including inspections by the Customer or an auditor mandated by the Customer, subject to reasonable notice, confidentiality, scope limitations and no more than once per twelve months unless required by a regulator or following a breach.',
        'Audits must not compromise the security or confidentiality of other customers\' data. Remote documentation review should be preferred to on-site inspection.',
        'No audit report, certification or independent assessment is currently claimed. Any audit rights must be scoped to what is realistically available for the deployment.',
      ],
    },
    {
      id: 'transfers',
      title: 'International Transfer Provisions',
      clauses: [
        'Where the processing involves a transfer of personal data to a country that does not provide an adequate level of protection, the parties must implement an appropriate transfer mechanism, such as standard contractual clauses, and record the relevant module and safeguards.',
        'The operator must identify the actual hosting and processing locations for the deployment and complete the subprocessor list before this section can be relied upon.',
        'Nothing in this template should be read as a representation that a transfer mechanism has been executed. That step requires completion and legal review.',
      ],
    },
    {
      id: 'template-notice',
      title: 'Template Status and Execution',
      clauses: [
        'This document is a template for negotiation. It is not legal advice and does not by itself create a binding DPA.',
        'Before execution, the parties must complete the operator\'s legal entity name, registered address, contact details, governing law, transfer mechanisms, subprocessor list and any customer-specific instructions.',
        'The signed version should be stored with the customer\'s contract records. The public version on this page is a reference copy only.',
        'ParsePilot makes no representation that this template satisfies the requirements of any particular jurisdiction. Qualified counsel must review it.',
      ],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial DPA template reflecting the implemented processing, retention and deletion behaviour. Requires legal review, completion and execution.' },
  ],
  related: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/subprocessors', label: 'Subprocessors' },
    { href: '/security', label: 'Security' },
  ],
};
