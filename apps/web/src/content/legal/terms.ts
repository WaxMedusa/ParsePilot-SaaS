import { legalConfig } from '@/config/legal';
import type { LegalDocument } from './types';

export const termsOfService: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  subtitle: 'The agreement between you and ParsePilot for use of the document extraction service.',
  version: legalConfig.versions.terms.version,
  effectiveDate: legalConfig.versions.terms.effectiveDate,
  lastUpdated: legalConfig.versions.terms.lastUpdated,
  summary: [
    'These terms govern your use of ParsePilot. By creating an account or using the service, you agree to them. If you are entering into these terms for a business, you confirm that you are authorised to bind that business.',
    'You keep ownership of the documents you upload. You grant us only the limited permission needed to store, process and display them so that we can provide the service.',
    'Extraction can be wrong. You are responsible for reviewing extracted values before using them for payments, accounting, tax filings or other business decisions. ParsePilot does not provide accounting, tax, financial or legal advice.',
  ],
  sections: [
    {
      id: 'acceptance',
      title: 'Acceptance of Terms',
      clauses: [
        'These Terms of Service ("Terms") form a binding agreement between you ("Customer", "you") and the operator of ParsePilot, identified on the contact page as the legal entity or individual operating the service (the "Operator", "we", "us").',
        'By creating an account, accessing the service, or clicking to accept these Terms, you agree to be bound by them. If you do not agree, do not use the service.',
        'If you use the service on behalf of an organisation, you represent that you have authority to accept these Terms for that organisation, and "you" includes that organisation.',
        'These Terms are a draft pending completion of the Operator\'s legal identity and jurisdiction details. They are not a substitute for legal advice and must be reviewed before commercial launch.',
      ],
    },
    {
      id: 'eligibility',
      title: 'Eligibility',
      clauses: [
        `You must be at least ${legalConfig.minimumAge} years old and legally capable of entering into a contract to use the service.`,
        'The service is intended for business use. If you are using it for personal purposes, consumer protection rules in your jurisdiction may apply and nothing in these Terms excludes rights that cannot lawfully be excluded.',
        'You must not use the service if you are barred from doing so under applicable law, including export control or sanctions rules.',
      ],
    },
    {
      id: 'accounts',
      title: 'Account Registration',
      clauses: [
        'You must provide accurate account information, keep it up to date, and use a valid email address that you control.',
        'One person may not maintain multiple free accounts to circumvent usage limits. We may refuse, suspend or merge accounts created to evade limits or abuse the service.',
        'You are responsible for all activity under your account and for ensuring that workspace members follow these Terms.',
        'We may require email verification or additional information before enabling certain features.',
      ],
    },
    {
      id: 'account-security',
      title: 'Account Security',
      clauses: [
        'You must keep your password confidential and must not share session credentials. Passwords must meet the minimum policy enforced at registration.',
        'You must notify us promptly at the security contact if you suspect unauthorised access to your account or workspace.',
        'We may revoke sessions, force a password reset, or temporarily restrict access if we reasonably believe an account is compromised.',
        'We are not liable for loss arising from your failure to protect your credentials, except to the extent caused by our own breach of these Terms or applicable law.',
      ],
    },
    {
      id: 'subscriptions',
      title: 'Subscription Plans',
      clauses: [
        'Paid features require an active subscription. Plans, page limits, file-size limits and features are displayed in the product and recorded in our database as the authoritative entitlement.',
        'We may change plan features or pricing with reasonable notice. Changes take effect at the start of your next billing period unless you cancel before then.',
        'Downgrades take effect at the start of the next billing period. If your usage exceeds the limits of the lower plan, further uploads may be blocked until the next period or until you upgrade.',
        'The free plan is provided as-is for evaluation and may be modified or withdrawn with notice. Free-plan limits are enforced server-side.',
      ],
    },
    {
      id: 'billing',
      title: 'Billing and Payments',
      clauses: [
        'Paid subscriptions are billed in advance in the currency shown at checkout, using the payment processor identified on the checkout page. Card details are handled by the payment processor and are not stored by us.',
        'Subscriptions renew automatically until cancelled. You authorise recurring charges for the selected billing period.',
        'If a payment fails, we may retry the charge, mark the subscription as past due, and suspend processing after a documented grace period. We will attempt to notify you before suspending paid features.',
        'Where taxes apply, they are added to the price shown or collected as required by law. Prices are exclusive of taxes unless stated otherwise.',
        'Fees are non-refundable except where required by law or expressly agreed. If you cancel, you retain access to paid features until the end of the current period.',
        'We may suspend or terminate paid access for chargeback abuse or fraudulent payment activity.',
      ],
    },
    {
      id: 'free-plan',
      title: 'Free Plan Limitations',
      clauses: [
        'The free plan includes a monthly page allowance, a maximum file size and a limited member count, as displayed in the product and enforced by the API.',
        'Free-plan workspaces may have a shorter document retention option and may not include every export format.',
        'Usage limits reset at the start of each period. Unused pages do not roll over unless expressly stated.',
        'We may adjust free-plan limits to prevent abuse, provided the change is communicated and does not affect pages already processed in the current period.',
      ],
    },
    {
      id: 'usage-limits',
      title: 'Usage Limits',
      clauses: [
        'Document processing is counted in pages. Pages are charged when a processing job completes successfully. A retry of the same job is not charged again.',
        'A deliberate reprocess of a document creates a new processing job and may count as a new page charge. The billing policy is documented in the product and on the pricing page.',
        'We may impose fair-use limits on requests, uploads, exports and API calls. Rate limits are enforced server-side and communicated through response headers.',
        'Exceeding a hard limit may result in uploads being rejected, jobs being queued with a lower priority, or access being suspended after notice.',
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable Use',
      clauses: [
        'You must comply with the Acceptable Use Policy, which forms part of these Terms.',
        'You must not upload malware, documents designed to exploit software, or documents whose contents you are not authorised to process.',
        'You must not attempt to access another workspace, bypass authorisation, probe the service for vulnerabilities without authorisation, or use the service to build a competing extraction product from our prompts, schema or internal APIs.',
        'We may investigate suspected abuse and suspend or terminate accounts where the Acceptable Use Policy is breached.',
      ],
    },
    {
      id: 'content-ownership',
      title: 'Uploaded Content Ownership',
      clauses: [
        'You retain all rights, title and interest in the documents you upload and in the data you submit to the service. We do not claim ownership of your documents or extracted data.',
        'You grant us a limited, non-exclusive licence to store, reproduce, transmit and process your documents solely to provide the service, to secure and maintain it, and to comply with law. This licence ends when the relevant data is deleted, subject to backup and legal-retention obligations.',
        'You grant us permission to use aggregated, de-identified operational statistics — such as counts of documents processed or average processing time — to operate and improve the service. These statistics do not identify you or your documents.',
        'We will not access document contents for our own purposes, except with your instruction, to investigate a security incident, or where required by law.',
      ],
    },
    {
      id: 'customer-responsibilities',
      title: 'Customer Responsibilities',
      clauses: [
        'You are responsible for the lawfulness of the documents you upload, including any notices or consents required for personal information they contain.',
        'You are responsible for configuring workspace membership and roles appropriately, for removing access for people who should no longer have it, and for maintaining backups of any data you cannot afford to lose.',
        'You must review extracted data before relying on it. Automated extraction is probabilistic and may misread values, mis-associate totals, or lose formatting.',
        'You must comply with the terms of any third-party service you use alongside ParsePilot, including the payment processor and any AI provider you configure.',
      ],
    },
    {
      id: 'ai-results',
      title: 'AI-Generated Extraction Results',
      clauses: [
        'Extraction results are generated by automated systems, including machine-learning models where configured. They are not statements of fact and are not verified against the document by a human unless you perform that review.',
        'We provide confidence scores, validation warnings and review queues to help you identify uncertain results, but no score is a guarantee of accuracy.',
        'You must not rely on extraction output as the sole basis for payments, journal entries, tax filings, regulatory reports or other decisions with legal or financial consequences.',
        'We may improve the extraction pipeline over time. Improvements can change results for the same input; extraction versions let you see which pipeline version produced a value.',
      ],
    },
    {
      id: 'accuracy',
      title: 'Accuracy Limitations',
      clauses: [
        'OCR and text extraction can fail on poor scans, unusual fonts, handwriting, stamps, multi-column layouts and damaged documents. Some values may be missing or incorrect.',
        'We do not warrant that extracted amounts, dates, tax identifiers or line items are correct, complete or suitable for any particular accounting standard.',
        'You are responsible for reconciling extracted data with the source document and with your financial records.',
        'If you discover a systematic extraction defect, report it so that we can investigate and, where appropriate, reprocess affected documents.',
      ],
    },
    {
      id: 'third-parties',
      title: 'Third-Party Services',
      clauses: [
        'The service may depend on third-party providers listed on the subprocessors page, including hosting, storage, payment processing and, where configured, AI extraction.',
        'We are not responsible for outages or acts of third parties beyond our reasonable control, but we will use reasonable efforts to restore service and to notify you of material disruptions.',
        'Third-party services may have their own terms and privacy policies. Your use of those services is between you and the relevant provider.',
      ],
    },
    {
      id: 'intellectual-property',
      title: 'Intellectual Property',
      clauses: [
        'The service, including its software, design, documentation, extraction schema and the underlying models and prompts, is owned by us or our licensors and is protected by intellectual-property laws.',
        'We grant you a non-exclusive, non-transferable right to use the service for your internal business purposes during your subscription, subject to these Terms.',
        'You must not copy, modify, decompile, reverse engineer, resell or create derivative works from the service except as permitted by law or with our written consent.',
        'Feedback you provide may be used by us without restriction or obligation, provided we do not disclose your confidential information.',
      ],
    },
    {
      id: 'availability',
      title: 'Service Availability',
      clauses: [
        'We aim to keep the service available, but we do not guarantee uninterrupted availability unless a separate written service-level agreement says otherwise.',
        'Planned maintenance may temporarily interrupt processing. Queued jobs are durable and resume after maintenance; uploads may be unavailable during some windows.',
        'The service is provided on an "as available" basis. This does not limit any rights you have under mandatory law.',
      ],
    },
    {
      id: 'termination',
      title: 'Suspension and Termination',
      clauses: [
        'You may stop using the service at any time. You may request account deletion in Privacy & Data settings. Cancellation of a paid subscription takes effect at the end of the current billing period.',
        'We may suspend or terminate access immediately if you materially breach these Terms, fail to pay, create a security risk, or use the service unlawfully. Where practical, we will give notice and an opportunity to remedy the breach.',
        'On termination, your right to use the service ends. We will make data available for export for a reasonable period where the termination is not caused by a serious breach, then delete it according to the retention policy.',
        'Sections that by their nature should survive termination — including ownership, disclaimers, liability limits and governing law — survive.',
      ],
    },
    {
      id: 'data-deletion',
      title: 'Data Deletion',
      clauses: [
        'Deleting a document revokes access immediately and schedules its storage object and dependent records for purging after the documented window.',
        'Deleting a workspace or account removes associated documents, extraction records and storage objects, subject to the retention and backup exceptions described in the Privacy Policy.',
        'We may retain billing records where required by law, and anonymised operational records that no longer identify you.',
        'You are responsible for exporting any data you need before deleting your account or workspace.',
      ],
    },
    {
      id: 'liability',
      title: 'Limitation of Liability',
      clauses: [
        'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, revenue, goodwill, business opportunity, or for decisions made in reliance on extracted data.',
        'To the maximum extent permitted by law, our aggregate liability arising out of or relating to the service is limited to the fees you paid to us for the service in the twelve months preceding the event giving rise to the claim, or the amount required by applicable law if greater.',
        'Nothing in these Terms excludes or limits liability that cannot lawfully be excluded, including liability for fraud, wilful misconduct, or death or personal injury caused by negligence.',
        'The limitations apply even if a remedy fails its essential purpose, and they reflect the allocation of risk between the parties.',
      ],
    },
    {
      id: 'warranties',
      title: 'Disclaimer of Warranties',
      clauses: [
        'Except as expressly stated in these Terms, the service is provided "as is" and "as available", without warranties of any kind, whether express, implied or statutory.',
        'We disclaim implied warranties of merchantability, fitness for a particular purpose, title and non-infringement to the maximum extent permitted by law.',
        'We do not warrant that the service will be error-free, that extraction will be accurate, or that defects will be corrected within a particular time.',
        'No advice or information obtained from us creates a warranty not expressly stated in these Terms.',
      ],
    },
    {
      id: 'indemnification',
      title: 'Indemnification',
      clauses: [
        'You agree to indemnify and hold us harmless from claims, damages, liabilities and reasonable costs arising from documents you upload, your use of the service in breach of these Terms, or your violation of law or third-party rights.',
        'We agree to indemnify you against third-party claims that the service, as provided by us and used in accordance with these Terms, infringes that third party\'s intellectual-property rights, subject to prompt notice and control of the defence.',
        'The indemnified party must provide reasonable cooperation and may not settle a claim in a way that admits liability on the other party\'s behalf without consent.',
      ],
    },
    {
      id: 'disputes',
      title: 'Dispute Resolution',
      clauses: [
        'Before starting formal proceedings, the parties will attempt in good faith to resolve a dispute through written notice and discussion for at least 30 days.',
        'If the dispute is not resolved, it will be brought in the courts or forum specified in the governing-law section, unless mandatory local law gives you a different forum.',
        'Nothing in this section prevents either party from seeking urgent injunctive relief to protect its intellectual property or the security of the service.',
        'Class-action waivers and arbitration clauses are not included in this draft because enforceability varies by jurisdiction; they must be added only after legal review where permitted.',
      ],
    },
    {
      id: 'governing-law',
      title: 'Governing Law',
      clauses: [
        `These Terms are governed by the laws of ${legalConfig.governingJurisdiction}, without regard to conflict-of-law rules.`,
        `The courts of ${legalConfig.governingCourts} have exclusive jurisdiction, subject to any mandatory consumer protections that apply in your country of residence.`,
        'If a provision is found unenforceable, it will be limited or severed to the minimum extent necessary, and the remaining provisions remain in effect.',
        'The United Nations Convention on Contracts for the International Sale of Goods does not apply.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes to Terms',
      clauses: [
        'We may update these Terms to reflect changes in the service or law. The version and last-updated date at the top of the page will change.',
        'For material changes, we will provide reasonable advance notice, for example by email or an in-product notice. Changes apply from the stated effective date.',
        'If you do not agree to a material change, you may stop using the service and cancel before the change takes effect.',
        'This draft must be reviewed and finalised before it is used as a binding commercial agreement.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact Information',
      clauses: [
        `General contact: ${legalConfig.contactEmail}. Legal notices: ${legalConfig.businessAddress}.`,
        `Security matters: ${legalConfig.securityEmail}. Privacy requests: ${legalConfig.privacyEmail}.`,
        `The Operator\'s legal entity name, registration number and address are ${legalConfig.legalEntityName}, ${legalConfig.registrationNumber} and ${legalConfig.businessAddress}. These details are placeholders that must be completed before launch.`,
      ],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial draft aligned with the implemented product, billing policy and deletion flows. Requires legal review and completion of entity details.' },
  ],
  related: [
    { href: '/acceptable-use', label: 'Acceptable Use Policy' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/data-processing', label: 'Data Processing Agreement' },
  ],
};
