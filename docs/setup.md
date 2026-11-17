# Local setup

## Prerequisites

| Component | Version | Notes |
| --- | --- | --- |
| Node.js | 20.11+ | Next.js 15 and Prisma 6 |
| npm | 10+ | workspaces; lockfile is committed |
| Python | 3.12+ | worker, scheduler, PyMuPDF |
| PostgreSQL | 16 | authoritative database and default queue |
| Redis | 7 | optional legacy `QUEUE_DRIVER=redis` mode only |
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

`DATABASE_URL` must point at PostgreSQL. For development storage, `OBJECT_STORAGE_DRIVER=local` writes under
`STORAGE_LOCAL_ROOT` (gitignored). For MinIO, set `OBJECT_STORAGE_DRIVER=s3` and the `S3_*` values. For production
without S3, set `OBJECT_STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`SUPABASE_STORAGE_BUCKET`; the bucket must exist and must not be public. The Supabase service-role key is server-only.
The bucket's allowed MIME types must include the uploads plus generated artefacts: `text/csv`,
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `application/json`. Otherwise uploads succeed
but exports fail at the storage step.
`STORAGE_DRIVER` remains accepted for Docker Compose, but do not set it on Vercel because Buildah reserves that name.

`src/lib/env.ts` validates production configuration and rejects placeholder secrets when `NODE_ENV=production`.

For password reset, email verification and invitations, set `EMAIL_PROVIDER=resend` or `postmark`, `EMAIL_FROM`, and
the matching API key (`RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`). Without a provider, development returns a one-time
link in the UI and production has no working password recovery.

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

Three processes are required for full functionality in the default database-queue mode:

```bash
npm run dev
cd services/processor && .venv/bin/python -m app.worker
cd services/processor && .venv/bin/python -m app.scheduler
```

- Web is on <http://localhost:3000>.
- The worker polls `/api/v1/internal/jobs/next` and claims each job atomically; PostgreSQL is the queue.
- The scheduler reconciles stalled jobs and runs the hourly retention sweep.
- The FastAPI processor on port 8000 is only needed for the legacy Redis/RQ mode.

Without a running worker, the web UI still works but uploads remain `queued` in PostgreSQL. Without Redis in the
default mode, `/ready` remains healthy because PostgreSQL supplies the queue.

## 5. Verify

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready | jq
# Legacy Redis/RQ mode only:
# curl -s http://localhost:8000/health
# curl -s http://localhost:8000/ready | jq
```

Sign in, upload a PDF, and watch the status transition through the documented stages. If AI extraction is not
configured, the deterministic rules pipeline is used and a warning is recorded.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `P1001` from Prisma | PostgreSQL not running / wrong URL | start PostgreSQL; check `DATABASE_URL` host and port |
| Uploads stay `queued` | worker not running or cannot reach the web internal API | start `python -m app.worker`; check `/ready` and the worker logs |
| `ocr_unavailable` | Tesseract missing in worker image | install `tesseract-ocr` and `tesseract-ocr-eng` |
| Exports fail with `export_upload_failed` | bucket MIME allow-list excludes CSV/XLSX/JSON | add those types to the Supabase Storage bucket |
| `/ready` 503 in production | database or storage down, or legacy Redis/processor down | inspect the response `checks` object |
| Password reset has no email | no email provider configured | set `EMAIL_PROVIDER`, `EMAIL_FROM` and the provider API key; development shows a one-time reset URL |
| Production start throws "Legal configuration incomplete" | legal launch gate | complete `src/config/legal.ts` (docs/legal-configuration.md) |

Never disable the legal gate by editing `instrumentation.ts`; complete the configuration instead.
