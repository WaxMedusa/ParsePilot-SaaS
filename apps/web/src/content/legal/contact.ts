import { legalConfig } from '@/config/legal';
import type { LegalDocument } from './types';

export const contactPage: LegalDocument = {
  slug: 'contact',
  title: 'Contact ParsePilot',
  subtitle: 'How to reach us about the product, privacy requests, security reports and legal notices.',
  version: '1.0-draft',
  effectiveDate: legalConfig.versions.security.effectiveDate,
  lastUpdated: '2026-11-15',
  summary: [
    'Use the channel that matches your request. Security reports should never be sent to a general support address, and privacy requests should not include document contents unless we ask for them.',
    'The email addresses, legal entity name and postal address below are placeholders. They are intentionally not invented; the operator must complete them before launch.',
  ],
  sections: [
    {
      id: 'channels',
      title: 'Contact Channels',
      clauses: [
        { lead: 'Product and account support.', text: `${legalConfig.contactEmail} — placeholder for the monitored support mailbox.` },
        { lead: 'Privacy and data requests.', text: `${legalConfig.privacyEmail} — placeholder for the privacy mailbox. Signed-in users can also use Privacy & Data settings in the dashboard.` },
        { lead: 'Security reports.', text: `${legalConfig.securityEmail} — placeholder for the security mailbox. Do not include live credentials or real customer documents.` },
        { lead: 'Legal notices.', text: `${legalConfig.contactEmail} — mark the subject as "Legal notice". Postal notices must go to the registered address once supplied.` },
      ],
    },
    {
      id: 'privacy-requests',
      title: 'Privacy Requests',
      clauses: [
        'If you have an account, the fastest route is Privacy & Data settings: request an account export, delete documents, revoke sessions or request account deletion after re-authentication.',
        'If you cannot sign in, contact the privacy address from the email associated with your account. We may need to verify control of that address before acting.',
        'If your information was uploaded by a business customer, they are normally the controller. We will refer your request to them and support their response.',
        'We do not charge a fee for reasonable requests, but may charge a reasonable fee or refuse manifestly unfounded or excessive requests where the law permits.',
      ],
    },
    {
      id: 'security',
      title: 'Security Disclosure',
      clauses: [
        'Report suspected vulnerabilities to the security address with reproduction steps that use synthetic data.',
        'Do not test against production, access other users\' data, or run denial-of-service tests. Read the Security page for the full responsible-disclosure expectations.',
        'We do not currently operate a paid bug-bounty programme. Any statement to the contrary should be treated as unauthorised.',
      ],
    },
    {
      id: 'business-details',
      title: 'Business Details',
      clauses: [
        { lead: 'Legal entity.', text: legalConfig.legalEntityName },
        { lead: 'Registered address.', text: legalConfig.businessAddress },
        { lead: 'Company registration.', text: legalConfig.registrationNumber },
        { lead: 'VAT number.', text: legalConfig.vatNumber },
        { lead: 'Governing law.', text: legalConfig.governingJurisdiction },
        { lead: 'Data protection contact.', text: legalConfig.dpoContact },
      ],
      note: 'These fields are incomplete on purpose. Do not publish a launch until the operator supplies real details and the deployment checklist passes.',
    },
    {
      id: 'response',
      title: 'Response Expectations',
      clauses: [
        'We aim to acknowledge support requests within two business days and privacy requests within the period required by applicable law.',
        'Security reports are prioritised by severity. Acknowledgement times depend on the operator\'s monitoring arrangements, which must be documented before launch.',
        'These are targets, not contractual service levels, unless a separate written agreement says otherwise.',
      ],
    },
    {
      id: 'no-fabrication',
      title: 'Why Details Are Missing',
      clauses: [
        'This deployment is a working product build without a finalized legal entity, address or monitored mailboxes. Inventing them would create false legal representations.',
        'The placeholders are machine-checked: a production build fails its legal checklist until they are completed.',
        'Once the operator supplies the details, they are configured in one place and rendered across every legal page automatically.',
      ],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial contact page. All business identifiers remain placeholders pending operator completion.' },
  ],
  related: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/security', label: 'Security' },
    { href: '/terms', label: 'Terms of Service' },
  ],
};
