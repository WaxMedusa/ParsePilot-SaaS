# Testing

## Commands

```bash
npm run typecheck          # TypeScript, including tests
npm test                   # Vitest (apps/web)
npm run test:py            # pytest (services/processor)
npm run check:design       # no gradients, no Tailwind, asymmetric hero
npm run check:legal        # legal page/placeholder report
npm run verify             # design + legal + typecheck
```

## Web (Vitest)

| File | Kind | Covers |
| --- | --- | --- |
| `src/lib/documents/fields.test.ts` | unit | date/currency/decimal normalisation, totals validation |
| `src/lib/auth/password.test.ts` | security | scrypt hashing, verification, policy, malformed hashes |
| `src/lib/jobs/retry.test.ts` | reliability | exponential backoff bounds, jitter, 15-minute cap |
| `src/content/legal/legal.test.ts` | content | all eight documents, anchors, versions, placeholders, no invented claims |
| `src/lib/tenant-isolation.integration.test.ts` | integration | cross-workspace denial, ledger idempotency, per-workspace usage |

Integration tests require PostgreSQL with migrations and the plan seed. They skip automatically when the database is
unreachable and report a prerequisite test instead. `src/test/setup.ts` loads `.env` so `DATABASE_URL` is available.

```bash
npm run db:migrate
npm run db:seed
npm test
```

## Processor (pytest)

- normalisation and field registry
- rule extraction and classification
- cross-field validation
- CSV/XLSX generation and formula-injection protection
- internal enqueue authentication (missing/wrong token, payload validation)

```bash
cd services/processor
.venv/bin/python -m pytest -q
```

## What was verified in this workspace

- `npx tsc --noEmit` on the web app (clean).
- `npm test`: 21 tests across 5 files, including DB-backed tenant isolation and ledger idempotency against local
  PostgreSQL 16.
- `python -m pytest`: 18 tests in `services/processor` (normalisation, extraction, validation, CSV/XLSX safety,
  internal token enforcement).
- `npm run check:design` and `npm run check:legal` (non-strict); the strict legal gate exits 1 as designed.
- `npm run build` (Next.js production build) completed.
- Live smoke test with PostgreSQL, Redis (redislite local binary), FastAPI processor, RQ worker and Next.js dev server:
  sign-in, PDF upload, full processing to `completed`, duplicate detection to `needs_review`, field edit preserving the
  original value, CSV export generation and download, privacy export through the retention sweep, cookie consent
  persistence, CSRF rejection, foreign-workspace rejection, XLSX plan gating, and all page routes returning 200 (or the
  expected auth redirect).

## What was not verified here

- `docker compose up`: no Docker daemon in this workspace. Files were authored but the stack was not executed. Image
  builds and compose startup therefore remain unverified.
- Live Stripe checkout and webhook delivery: no Stripe account or CLI session. Signature/idempotency paths are code-
  reviewed, not exercised against Stripe.
- Real OCR: Tesseract is not installed in this workspace, so scanned-image extraction was not executed end-to-end;
  native-text PDFs and the `ocr_unavailable` failure path are covered.
- Email delivery: no provider configured; the development reset flow returns a URL instead.
- Cross-browser, responsive and screen-reader testing.
- Docker image/compose runtime, worker crash recovery under real SIGKILL, and Stripe replay attacks.

Report these as limitations rather than assuming they work.
