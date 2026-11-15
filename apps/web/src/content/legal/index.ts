import type { LegalDocument } from './types';
import { privacyPolicy } from './privacy';
import { termsOfService } from './terms';
import { securityPage } from './security';
import { dataProcessingAgreement } from './data-processing';
import { cookiePolicy } from './cookies';
import { acceptableUsePolicy } from './acceptable-use';
import { subprocessorPage } from './subprocessors';
import { contactPage } from './contact';

export const LEGAL_PAGES = [
  { slug: 'privacy', label: 'Privacy Policy' },
  { slug: 'terms', label: 'Terms of Service' },
  { slug: 'data-processing', label: 'Data Processing Agreement' },
  { slug: 'security', label: 'Security' },
  { slug: 'subprocessors', label: 'Subprocessors' },
  { slug: 'cookies', label: 'Cookie Policy' },
  { slug: 'acceptable-use', label: 'Acceptable Use' },
  { slug: 'contact', label: 'Contact' },
] as const;

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  privacy: privacyPolicy,
  terms: termsOfService,
  security: securityPage,
  'data-processing': dataProcessingAgreement,
  cookies: cookiePolicy,
  'acceptable-use': acceptableUsePolicy,
  subprocessors: subprocessorPage,
  contact: contactPage,
};

export function getLegalDocument(slug: string): LegalDocument {
  const document = LEGAL_DOCUMENTS[slug];
  if (!document) throw new Error(`Unknown legal document: ${slug}`);
  return document;
}
