import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { CookiePreferencesSupplement } from '@/components/legal/CookiePreferencesSupplement';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'The first-party cookies ParsePilot sets, their purpose and lifetime, and how to change your preferences.',
};

export default function CookiesPage() {
  return (
    <>
      <LegalLayout document={getLegalDocument('cookies')} />
      <CookiePreferencesSupplement />
    </>
  );
}
