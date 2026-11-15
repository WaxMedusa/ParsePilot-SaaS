import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The agreement governing use of ParsePilot, including ownership, billing, AI accuracy limitations and liability.',
};

export default function TermsPage() {
  return <LegalLayout document={getLegalDocument('terms')} />;
}
