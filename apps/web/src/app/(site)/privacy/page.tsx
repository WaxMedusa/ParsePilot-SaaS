import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How ParsePilot collects, processes, stores and deletes account data, uploaded documents and extracted data.',
};

export default function PrivacyPage() {
  return <LegalLayout document={getLegalDocument('privacy')} />;
}
