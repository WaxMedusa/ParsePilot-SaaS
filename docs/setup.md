# Local setup

## Prerequisites

| Component | Version | Notes |
| --- | --- | --- |
| Node.js | 20.11+ | Next.js 15 and Prisma 6 |
| npm | 10+ | workspaces; lockfile is committed |
| Python | 3.12+ | FastAPI, RQ, PyMuPDF |
| PostgreSQL | 16 | authoritative database |
| Redis | 7 | queue and readiness |
| Tesseract | 5.x | optional; OCR fallback only |
| MinIO | optional | use `STORAGE_DRIVER=s3`; local disk is the default |

## 1. Environment

```bash
cp .env.example .env
```

Generate three independent secrets:

```bash
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 32   # DOWNLOAD_SIGNING_SECRET
openssl rand -hex 32   # INTERNAL_SERVICE_TOKEN
```

`DATABASE_URL` must point at PostgreSQL. For development storage, `STORAGE_DRIVER=local` writes under
`STORAGE_LOCAL_ROOT` (gitignored). For MinIO, set `STORAGE_DRIVER=s3` and the `S3_*` values. The bucket must exist and
must not be public.

`src/lib/env.ts` validates production configuration and rejects placeholder secrets when `NODE_ENV=production`.

## 2. Install

```bash
npm ci
cd services/processor
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 3. Database

```bash
createdb parsepilot
npm run db:migrate     # prisma migrate dev, creates apps/web/prisma/migrations
npm run db:seed        # plan catalogue; optionally a demo user
```

The seed is idempotent. Demo accounts are blocked when `NODE_ENV=production`:

```bash
SEED_DEMO_USER=true SEED_DEMO_EMAIL=operator@example.test \
SEED_DEMO_PASSWORD='a-strong-local-password' npm run db:seed
```

## 4. Processes

Four processes are required for full functionality:

```bash
npm run dev
cd services/processor && .venv/bin/uvicorn app.main:app --reload --port 8000
cd services/processor && .venv/bin/python -m app.worker
cd services/processor && .venv/bin/python -m app.scheduler
```

- Web is on <http://localhost:3000>.
- The processor exposes `/health`, `/ready` and `/metrics`; enqueueing is `POST /internal/jobs` with
  `x-internal-token`.
- The worker consumes RQ jobs and drives document/export state through the web internal API.
- The scheduler re-announces stalled jobs and runs the hourly retention sweep.

Without Redis or the processor, the web UI still works but `/ready` reports degraded and uploads remain `queued` in
PostgreSQL until a worker is available.

## 5. Verify

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready | jq
curl -s http://localhost:8000/health
curl -s http://localhost:8000/ready | jq
```

Sign in, upload a PDF, and watch the status transition through the documented stages. If AI extraction is not
configured, the deterministic rules pipeline is used and a warning is recorded.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `P1001` from Prisma | PostgreSQL not running / wrong URL | start PostgreSQL; check `DATABASE_URL` host and port |
| Uploads stay `queued` | worker not running or Redis unreachable | start Redis and `python -m app.worker`; check `/ready` |
| `ocr_unavailable` | Tesseract missing in worker image | install `tesseract-ocr` and `tesseract-ocr-eng` |
| `/ready` 503 in production | Redis, processor or storage down | inspect the response `checks` object |
| Password reset has no email | no email provider configured | development returns a reset URL; production requires a provider |
| Production start throws "Legal configuration incomplete" | legal launch gate | complete `src/config/legal.ts` (docs/legal-configuration.md) |

Never disable the legal gate by editing `instrumentation.ts`; complete the configuration instead.
