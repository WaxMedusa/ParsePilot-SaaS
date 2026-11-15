import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Support, privacy, security and legal contact channels for ParsePilot.',
};

export default function ContactPage() {
  return <LegalLayout document={getLegalDocument('contact')} />;
}
