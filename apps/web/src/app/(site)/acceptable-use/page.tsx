import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'What may and may not be uploaded or done with ParsePilot, including security testing rules.',
};

export default function AcceptableUsePage() {
  return <LegalLayout document={getLegalDocument('acceptable-use')} />;
}
