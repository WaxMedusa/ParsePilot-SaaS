import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Security architecture, access controls, document protection and responsible disclosure for ParsePilot.',
};

export default function SecurityPage() {
  return <LegalLayout document={getLegalDocument('security')} />;
}
