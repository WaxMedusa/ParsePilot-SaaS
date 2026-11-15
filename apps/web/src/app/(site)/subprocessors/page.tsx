import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { getLegalDocument } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Subprocessors',
  description: 'External providers that may process data for a ParsePilot deployment, and what each one receives.',
};

export default function SubprocessorsPage() {
  return <LegalLayout document={getLegalDocument('subprocessors')} />;
}
