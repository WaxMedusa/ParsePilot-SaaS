import { legalConfig } from '@/config/legal';
import type { LegalDocument } from './types';

export const cookiePolicy: LegalDocument = {
  slug: 'cookies',
  title: 'Cookie Policy',
  subtitle: 'The cookies this application sets, what they are for, and how to change your choices.',
  version: legalConfig.versions.cookies.version,
  effectiveDate: legalConfig.versions.cookies.effectiveDate,
  lastUpdated: legalConfig.versions.cookies.lastUpdated,
  summary: [
    'ParsePilot uses a small number of essential cookies. They keep you signed in, protect forms against cross-site request forgery, and remember your cookie choice.',
    'Optional analytics and marketing cookies are disabled by default and are not currently loaded by this deployment. If that changes, they will only load after you consent to the relevant category.',
    'You can change your preferences at any time using the cookie settings link in the footer, or in the preference panel below.',
  ],
  sections: [
    {
      id: 'what-are-cookies',
      title: 'What Cookies Are',
      clauses: [
        'Cookies are small text files stored by your browser for a website. They allow a site to recognise a browser across requests, for example to keep a session active.',
        'We also use browser storage for local preferences. This policy covers both cookies and comparable local storage used for consent.',
        'Cookies can be first-party (set by us) or third-party (set by another domain). This deployment sets only first-party cookies.',
      ],
    },
    {
      id: 'categories',
      title: 'Cookie Categories',
      clauses: [
        { lead: 'Essential.', text: 'Required to deliver the service: authentication, session management, CSRF protection and storing your consent decision. These cannot be disabled while you use the service.' },
        { lead: 'Analytics.', text: 'Optional. Would help us understand aggregate usage, such as which pages are visited. No analytics cookies or scripts are currently loaded.' },
        { lead: 'Marketing.', text: 'Optional. Would support campaign attribution or advertising measurement. No marketing cookies are currently loaded.' },
        { lead: 'Preference.', text: 'Stores your cookie choice so that we do not ask on every visit. This is essential to respect your decision and is treated as an essential cookie.' },
      ],
    },
    {
      id: 'cookies-we-set',
      title: 'Cookies We Set',
      clauses: [
        'The table below lists the cookies set by this application. Lifetimes are defaults and may be adjusted by deployment configuration; the values shown must be kept consistent with the running configuration.',
      ],
      table: {
        columns: ['Cookie', 'Category', 'Purpose', 'Lifetime'],
        rows: [
          ['pp_session', 'Essential / authentication', 'Opaque session token that keeps you signed in. HttpOnly, SameSite=Lax, Secure in production.', 'Up to 30 days'],
          ['pp_csrf', 'Essential / security', 'Double-submit token used to reject cross-site state-changing requests.', 'Browser session'],
          ['pp_consent', 'Essential / preference', 'Records your cookie categories and the date you chose them.', '12 months'],
          ['Analytics cookies', 'Analytics', 'None currently set by this deployment.', '—'],
          ['Marketing cookies', 'Marketing', 'None currently set by this deployment.', '—'],
        ],
        caption: 'Only first-party cookies are used. No third-party advertising or analytics scripts are loaded.',
      },
    },
    {
      id: 'consent',
      title: 'Consent',
      clauses: [
        'On your first visit, a banner explains the categories and offers Accept all, Reject optional and Customise. Reject optional is presented with the same prominence as Accept all and does not require extra steps.',
        'Optional categories remain off until you turn them on. Choosing Reject optional stores that decision just as durably as accepting.',
        'Consent is recorded with a version so that a material change to this policy can require a fresh choice. The current consent version is shown in the preference panel.',
        'Withdrawing consent is as easy as giving it: reopen the settings from the footer at any time.',
      ],
    },
    {
      id: 'managing-preferences',
      title: 'Managing Preferences',
      clauses: [
        'Use the preference panel on this page or the Cookie settings link in the footer to change categories at any time.',
        'You can also delete or block cookies in your browser settings. Blocking essential cookies will prevent sign-in and may break the application.',
        'If you clear your browser storage, your stored choice is removed and the banner will ask again.',
      ],
    },
    {
      id: 'third-parties',
      title: 'Third-Party Cookies',
      clauses: [
        'This deployment does not set third-party cookies. Stripe checkout and billing portal pages are hosted by Stripe and may set their own cookies when you visit them; those are governed by Stripe\'s policies.',
        'If a third-party analytics or support tool is enabled in future, it will be documented here and will not load before consent.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes to This Policy',
      clauses: [
        'We may update this policy when cookies or the law change. The version and last-updated date will change, and the version history records the change.',
        'If a change requires new consent, we will ask for it before setting any new optional cookie.',
        'This version is a draft and requires legal review before commercial launch.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      clauses: [`Questions about cookies can be sent to ${legalConfig.privacyEmail}.`],
    },
  ],
  versionHistory: [
    { version: '1.0-draft', date: '2026-11-15', summary: 'Initial draft listing the three first-party cookies set by the application. No analytics or marketing cookies are in use.' },
  ],
  related: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
  ],
};
