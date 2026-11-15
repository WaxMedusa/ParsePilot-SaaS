import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Data Processing Agreement',
  description: 'Template DPA for business customers whose uploaded documents contain personal information.',
};

export default function DataProcessingPage() {
  return <LegalLayout document={getLegalDocument('data-processing')} />;
}
