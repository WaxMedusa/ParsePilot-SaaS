export type LegalClause = string | { lead: string; text: string; items?: string[] };

export type LegalTable = {
  columns: string[];
  rows: string[][];
  caption?: string;
};

export type LegalSection = {
  id: string;
  title: string;
  clauses: LegalClause[];
  list?: string[];
  table?: LegalTable;
  note?: string;
};

export type LegalDocument = {
  slug: string;
  title: string;
  subtitle: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  summary: string[];
  sections: LegalSection[];
  versionHistory: { version: string; date: string; summary: string }[];
  related?: { href: string; label: string }[];
};

export function isPlaceholderValue(value: string): boolean {
  return value.includes('[[REQUIRED:');
}
