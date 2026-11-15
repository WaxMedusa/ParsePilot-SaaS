# ParsePilot

Document data extraction for finance teams. Upload invoices, receipts, purchase orders and statements; a durable
background pipeline extracts text (with OCR only when needed), pulls structured fields, validates totals and routes
uncertain documents to human review. Reviewed data can be exported as CSV or XLSX.

This repository is a complete application: Next.js web app and REST API, PostgreSQL, Redis-backed Python worker,
private object storage, Stripe billing, privacy controls, legal pages and a Docker Compose stack.

## Design constraints

- **No gradients anywhere.** Solid colours only, enforced by `npm run check:design`.
- **No Tailwind.** CSS Modules and global design tokens only.
- **Asymmetrical editorial hero** (44/56 grid, left-aligned), enforced by the same check.
- Versioned REST API at `/api/v1`, OpenAPI 3.1 at `/api/v1/openapi` and a rendered reference at `/docs/api`.
- Workspace isolation is enforced in the data-access layer, never in the browser.

## Architecture

```
Browser ──► Next.js (apps/web) ──► PostgreSQL (authoritative state)
                │  │
                │  ├──► Redis (rate limits, readiness)
                │  ├──► Stripe webhooks (signature verified, replay-safe)
                │  └──► private object storage (local dev or S3/MinIO)
                │
                └──► FastAPI processor (services/processor) ──► Redis/RQ
                          ▲                                      │
                          └──── RQ worker ◄──────────────────────┘
                                     │
                                     └── internal API ──► Next.js ──► PostgreSQL
```

The database is the source of truth for every job. Redis only delivers work: if the queue is flushed or a worker dies,
the reconciler re-announces queued jobs from PostgreSQL. Usage is recorded in an idempotent ledger keyed by job id, so a
retry never charges twice. See [docs/billing.md](docs/billing.md).

## Repository layout

```
apps/web                 Next.js 15 app, API routes, Prisma schema and migrations
services/processor       FastAPI enqueue API, RQ worker, pipeline, scheduler, pytest suite
scripts                  Design, legal and backup tooling
docs                     Setup, deployment, security, retention, billing and recovery runbooks
docker-compose.yml       PostgreSQL, Redis, MinIO, web, processor, worker, scheduler
```

## Quickstart (local, without Docker)

Prerequisites: Node.js 20.11+, npm 10+, Python 3.12+, PostgreSQL 16, Redis 7. Tesseract is required only for scanned
documents (`apt-get install tesseract-ocr`).

```bash
cp .env.example .env
# Fill SESSION_SECRET, DOWNLOAD_SIGNING_SECRET and INTERNAL_SERVICE_TOKEN:
#   openssl rand -hex 32
npm ci
createdb parsepilot
npm run db:migrate
npm run db:seed
```

Install the Python service:

```bash
cd services/processor
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Run each process in its own terminal:

```bash
npm run dev                                  # web + API on :3000
cd services/processor && .venv/bin/uvicorn app.main:app --reload --port 8000
cd services/processor && .venv/bin/python -m app.worker
cd services/processor && .venv/bin/python -m app.scheduler
```

Open <http://localhost:3000>. Health is at `/health`, readiness at `/ready`, API docs at `/docs/api`.

To create a local demo account (never allowed in production):

```bash
SEED_DEMO_USER=true SEED_DEMO_EMAIL=operator@example.test \
SEED_DEMO_PASSWORD='choose-a-strong-password' npm run db:seed
```

## Configuration

All configuration is environment-based; see [.env.example](.env.example) and [docs/setup.md](docs/setup.md).
Secrets have no production fallbacks: `src/lib/env.ts` rejects a production start with development secrets.
Storage is `local` for development and `s3` for MinIO/S3. Stripe and AI extraction are optional; the app degrades
explicitly rather than silently inventing results.

## Testing and checks

```bash
npm run typecheck
npm test                 # Vitest: unit, security, reliability and DB-backed isolation tests
npm run test:py          # pytest (processor pipeline, exports, internal auth)
npm run check:design     # no gradients, no Tailwind, asymmetric hero
npm run check:legal      # legal page/placeholder report
npm run verify           # design + legal + typecheck
```

Database-backed Vitest tests skip automatically when PostgreSQL is unreachable. See [docs/testing.md](docs/testing.md).

## Docker Compose

```bash
cp .env.docker.example .env    # replace every secret
docker compose up --build
```

The stack includes migration and plan seeding, MinIO bucket creation and health checks. Read
[docs/deployment.md](docs/deployment.md) before exposing it.

## Legal launch gate

The eight legal pages render explicit `[[REQUIRED: ...]]` placeholders instead of invented company details,
addresses, emails, certifications or audit claims. A production server **refuses to start** while any placeholder
remains (`src/instrumentation.ts`), and `LEGAL_STRICT=1 npm run check:legal` fails CI. Complete
[docs/legal-configuration.md](docs/legal-configuration.md) before a commercial launch.

## Operational docs

- [Setup](docs/setup.md) · [Deployment](docs/deployment.md) · [Testing](docs/testing.md)
- [Backup and recovery](docs/backup-recovery.md) · [Incident response](docs/incident-response.md)
- [Security](docs/security.md) · [Retention](docs/retention.md) · [Billing](docs/billing.md)
- [API](docs/api.md) · [Legal configuration](docs/legal-configuration.md)

## Known limitations

- No transactional email provider is configured, so password-reset links are only returned in non-production
  responses. Production password reset needs an email provider.
- OCR depends on the Tesseract binary in the worker image; without it, image-only documents fail with
  `ocr_unavailable` instead of producing fabricated text.
- MFA, SSO and SCIM are not implemented.
- Docker Compose assets in this repository were authored but cannot be executed in this workspace (no Docker daemon).
  The application itself was verified with local PostgreSQL and Vitest/pytest.
