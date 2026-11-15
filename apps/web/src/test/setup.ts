import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest does not run Next's environment loader. Parse the local env files so
// database-backed tests can run against the same development database.
const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
for (const file of candidates) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = (rawValue ?? '').replace(/^"|"$/g, '');
  }
}

(process.env as Record<string, string>).NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'test';
