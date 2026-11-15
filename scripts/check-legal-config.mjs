#!/usr/bin/env node
/**
 * Legal launch gate.
 *
 * Default mode reports the outstanding items and succeeds, so local builds and
 * CI stay usable while legal review is in progress. Production (NODE_ENV=production)
 * or LEGAL_STRICT=1 fails the check while any placeholder remains. The web app
 * also enforces this at server start via src/instrumentation.ts.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const webRoot = join(root, 'apps', 'web');
const contentDir = join(webRoot, 'src', 'content', 'legal');
const configFile = join(webRoot, 'src', 'config', 'legal.ts');
const strict = process.env.NODE_ENV === 'production' || process.env.LEGAL_STRICT === '1';

const REQUIRED_SLUGS = [
  ['privacy', 'Privacy Policy'],
  ['terms', 'Terms of Service'],
  ['security', 'Security'],
  ['data-processing', 'Data Processing Agreement'],
  ['cookies', 'Cookie Policy'],
  ['acceptable-use', 'Acceptable Use'],
  ['subprocessors', 'Subprocessors'],
  ['contact', 'Contact'],
];

const problems = [];
const warnings = [];

for (const [slug, label] of REQUIRED_SLUGS) {
  const route = join(webRoot, 'src', 'app', '(site)', slug, 'page.tsx');
  if (!existsSync(route)) problems.push(`Missing legal route for ${label}: ${relative(root, route)}`);
  const source = join(contentDir, `${slug}.ts`);
  if (!existsSync(source)) problems.push(`Missing legal content for ${label}: ${relative(root, source)}`);
}

if (!existsSync(configFile)) {
  problems.push('Missing central legal configuration: apps/web/src/config/legal.ts');
} else {
  const config = readFileSync(configFile, 'utf8');
  if (!config.includes('legalReviewCompleted: true')) {
    warnings.push('legalConfig.legalReviewCompleted is not true (legal review has not been recorded)');
  }
}

let placeholderCount = 0;
const placeholderFiles = new Set();
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.ts')) {
      const text = readFileSync(full, 'utf8');
      const matches = text.match(/\[\[REQUIRED:[^\]]+\]\]/g) ?? [];
      if (matches.length > 0) {
        placeholderCount += matches.length;
        placeholderFiles.add(relative(root, full));
      }
    }
  }
}
if (existsSync(contentDir)) walk(contentDir);

const summary = {
  strict,
  requiredDocuments: REQUIRED_SLUGS.length,
  missingDocuments: problems.length,
  placeholderOccurrences: placeholderCount,
  filesWithPlaceholders: [...placeholderFiles],
  warnings,
  problems,
};

console.log(JSON.stringify(summary, null, 2));

if (problems.length > 0) {
  console.error(`\nLegal configuration has ${problems.length} structural problem(s).`);
  process.exit(1);
}

if (placeholderCount > 0 || warnings.length > 0) {
  const message =
    `Legal launch gate: ${placeholderCount} placeholder occurrence(s) and ${warnings.length} warning(s) remain. ` +
    'Complete src/config/legal.ts, replace every [[REQUIRED: ...]] value, and set legalReviewCompleted=true before a commercial launch.';
  if (strict) {
    console.error(`\nBLOCKED: ${message}`);
    process.exit(1);
  }
  console.warn(`\nWARNING (non-strict): ${message}`);
}

console.log('\nLegal configuration check passed for this mode.');
