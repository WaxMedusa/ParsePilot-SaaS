#!/usr/bin/env node
/**
 * Design constraint gate:
 *  1. no gradients of any kind in source or CSS
 *  2. no Tailwind dependency, config or directives
 *  3. the marketing hero uses an asymmetric two-column layout and left copy
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const webRoot = join(root, 'apps', 'web');
const srcRoot = join(webRoot, 'src');
const violations = [];

const GRADIENT_PATTERN = /(linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient)/i;
const TAILWIND_PATTERN = /(@tailwind\b|from ['"]tailwindcss['"]|require\(['"]tailwindcss['"]\))/i;

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(css|tsx|ts|jsx|js)$/.test(entry)) continue;
    const text = readFileSync(full, 'utf8');
    const path = relative(root, full);
    if (GRADIENT_PATTERN.test(text)) violations.push(`${path}: gradient detected (solid colours only)`);
    if (TAILWIND_PATTERN.test(text)) violations.push(`${path}: Tailwind directive/import detected`);
  }
}

walk(srcRoot);

for (const config of ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs', 'postcss.config.js']) {
  const full = join(webRoot, config);
  if (existsSync(full)) {
    const text = readFileSync(full, 'utf8');
    if (config.startsWith('tailwind') || text.includes('tailwindcss')) {
      violations.push(`${relative(root, full)}: Tailwind configuration present`);
    }
  }
}

const packageJson = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8'));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const name of Object.keys(deps)) {
  if (name === 'tailwindcss' || name.startsWith('@tailwindcss/')) {
    violations.push(`apps/web/package.json: Tailwind dependency present (${name})`);
  }
}

const heroCssPath = join(webRoot, 'src', 'components', 'marketing', 'Hero.module.css');
if (!existsSync(heroCssPath)) {
  violations.push('apps/web/src/components/marketing/Hero.module.css is missing');
} else {
  const hero = readFileSync(heroCssPath, 'utf8');
  if (!/grid-template-columns:\s*(?:[^;]*\b)?(40|42|44|45|46|48)fr/.test(hero)) {
    violations.push('Hero is not an asymmetric two-column grid (expected roughly 40/60 or 45/55)');
  }
  if (!/text-align:\s*left/.test(hero)) {
    violations.push('Hero copy is not explicitly left-aligned');
  }
  if (/grid-template-columns:\s*1fr 1fr/.test(hero)) {
    violations.push('Hero uses a symmetric 1fr 1fr layout; an asymmetric split is required');
  }
}

console.log(JSON.stringify({ violations: violations.length, details: violations }, null, 2));
if (violations.length > 0) {
  console.error(`\nDesign constraint check failed with ${violations.length} violation(s).`);
  process.exit(1);
}
console.log('Design constraint check passed: no gradients, no Tailwind, asymmetric left hero.');
