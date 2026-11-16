import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/instrument-sans';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import { CookieBanner } from '@/components/cookies/CookieBanner';
import { CsrfBootstrap } from '@/components/security/CsrfBootstrap';

export const metadata: Metadata = {
  title: {
    default: 'ParsePilot — Document data extraction for finance teams',
    template: '%s · ParsePilot',
  },
  description:
    'ParsePilot extracts structured data from invoices and receipts with validation, duplicate detection and a human review workflow. Private storage, versioned results and exports your finance team can audit.',
  applicationName: 'ParsePilot',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f3f1eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <CsrfBootstrap />
        <CookieBanner />
      </body>
    </html>
  );
}
