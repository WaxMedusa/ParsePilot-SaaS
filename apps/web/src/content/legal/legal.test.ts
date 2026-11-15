import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS, LEGAL_PAGES } from './index';
import { listOutstandingPlaceholders } from '../../config/legal';

const REQUIRED = ['privacy', 'terms', 'security', 'data-processing', 'cookies', 'acceptable-use', 'subprocessors', 'contact'];

describe('legal document set', () => {
  it('contains all eight required documents', () => {
    for (const slug of REQUIRED) {
      expect(LEGAL_DOCUMENTS[slug], `missing legal document: ${slug}`).toBeDefined();
      expect(LEGAL_PAGES.some((page) => page.slug === slug)).toBe(true);
    }
  });

  it('has well-formed version history and sections', () => {
    for (const [slug, document] of Object.entries(LEGAL_DOCUMENTS)) {
      expect(document.slug).toBe(slug);
      expect(document.version.length).toBeGreaterThan(0);
      expect(document.sections.length).toBeGreaterThan(3);
      expect(document.versionHistory.length).toBeGreaterThan(0);
      for (const section of document.sections) {
        expect(section.id).toMatch(/^[a-z0-9-]+$/);
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.clauses.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses explicit REQUIRED placeholders rather than invented business details', () => {
    const outstanding = listOutstandingPlaceholders();
    expect(outstanding.length).toBeGreaterThan(0);
    expect(outstanding.join(' ')).toContain('[[REQUIRED:');
    expect(outstanding.join(' ')).toContain('legal review not marked complete');
  });

  it('does not claim certifications or audit reports that have not been evidenced', () => {
    const text = Object.values(LEGAL_DOCUMENTS)
      .map((document) => JSON.stringify(document))
      .join(' ')
      .toLowerCase();
    for (const claim of ['soc 2 certified', 'iso 27001 certified', 'pci dss certified', 'hipaa certified']) {
      expect(text).not.toContain(claim);
    }
  });
});
