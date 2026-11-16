# Deployment

## Before anything else: legal and secrets

1. Complete every `[[REQUIRED: ...]]` in `apps/web/src/config/legal.ts`, set real policy versions/effective dates and
   `legalReviewCompleted: true`. The production web server refuses to start otherwise.
2. Generate independent 32-byte secrets for `SESSION_SECRET`, `DOWNLOAD_SIGNING_SECRET` and `INTERNAL_SERVICE_TOKEN`.
3. Confirm `NODE_ENV=production` and that no development secret remains. `src/lib/env.ts` rejects them.
4. Run `LEGAL_STRICT=1 npm run check:legal` and `npm run check:design` in CI.

## Docker Compose

```bash
cp .env.docker.example .env
# replace every secret, then:
docker compose build
docker compose up -d
docker compose ps
```

Services:

| Service | Purpose | Port |
| --- | --- | --- |
| postgres | PostgreSQL 16 with checksums | 5432 (do not expose publicly) |
| redis | RQ queue, append-only persistence | 6379 (do not expose publicly) |
| minio / minio-init | private object storage + bucket creation | 9000/9001 |
| migrate | `prisma migrate deploy` + plan seed, runs once | — |
| web | Next.js standalone server | 3000 |
| processor | FastAPI enqueue/health API | 8000 (internal only) |
| worker | RQ worker executing documents and exports | — |
| scheduler | reconciliation + retention sweep | — |

The `web` service waits for migrations, Redis, the bucket and processor health. `worker` and `scheduler` wait for web
health because they call its internal API.

## Vercel (web and processor services)

The root `vercel.json` deploys both services in one Vercel project (Services is a Vercel beta feature):

- `web` is the Next.js app at `apps/web`. Every public route is rewritten to it.
- `processor` is the FastAPI enqueue/health service at `services/processor`. It has no public route; the web service
  receives its internal URL through the `PROCESSOR_URL` service binding.

Import the repository at the **root**, not `apps/web`, so Vercel can read `vercel.json`. Vercel builds each service
separately and installs the npm workspace from the root lockfile. Node.js must be 20.11 or newer.

Vercel Services does not support Edge Functions. This app therefore has no Edge middleware: the CSRF cookie is issued
by `GET /api/v1/auth/csrf` and bootstrapped in the browser, while the dashboard layout enforces authentication. Do not
reintroduce `src/middleware.ts` or an `export const runtime = 'edge'` route in the `web` service.

Environment variables are shared by both services:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL. Use the provider's transaction-pooler URL for serverless functions. |
| `SESSION_SECRET`, `DOWNLOAD_SIGNING_SECRET`, `INTERNAL_SERVICE_TOKEN` | Independent 32-byte random values. |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | Public HTTPS origin. If omitted, the app falls back to Vercel's deployment URL. |
| `STORAGE_DRIVER=s3` plus `S3_*` | Required: Vercel functions have a read-only filesystem apart from `/tmp`. |
| `REDIS_URL` | Required for rate limiting and for handing jobs to the worker. |
| `AI_API_KEY` / `AI_*` | Optional; without a key the deterministic extraction rules are used. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Only when billing is enabled. |

The FastAPI service only enqueues work. The long-running RQ **worker** and **scheduler** are not services; run them
as Vercel Daemons (containers) or on any container host. They need `REDIS_URL`, `INTERNAL_SERVICE_TOKEN` and a
`WEB_INTERNAL_URL` that reaches this deployment, and the worker also needs `AI_*`/OCR configuration. Without a worker,
uploads queue but never finish. The existing `services/processor/Dockerfile` can be used for a daemon or container.

Run migrations from CI or a workstation, not from the Vercel build:

```bash
DATABASE_URL='postgresql://...' npx prisma migrate deploy --schema apps/web/prisma/schema.prisma
```

Seed the public plans once; the marketing pricing section falls back to the catalogue defaults when the database is
unavailable, but checkout needs the seeded rows.

### Legal gate on Vercel

Vercel previews (`VERCEL_ENV=preview`) render the draft legal pages and log the outstanding items, so you can review the
site without pretending the business details are complete. A Vercel **production** deployment still refuses to start
while the placeholders remain. Only for a non-public demonstration may you set `LEGAL_GATE_MODE=warn`; never use that
mode for a commercial launch. Complete `apps/web/src/config/legal.ts` and set `legalReviewCompleted=true` first.

### Commit authorship on Vercel Hobby

On a Hobby plan, Vercel blocks deployments of private repositories when the head commit author is not a member of the
Vercel project. Automation commits under a bot identity are blocked even when the code is valid. Make deployment
commits from the GitHub account that owns the Vercel project, or upgrade the team and add the collaborator. Correct
this with a new owner-authored commit rather than rewriting already-pushed history.

## Production hardening checklist

- Terminate TLS at a reverse proxy or load balancer; forward `X-Forwarded-Proto`. HSTS is emitted when
  `NODE_ENV=production`.
- Do not publish PostgreSQL, Redis, MinIO or the processor port to the internet. Restrict them to the private network.
- Use a managed PostgreSQL with automated backups and PITR; managed Redis with persistence; S3 with SSE and versioning.
- Store secrets in a secret manager, not in a committed `.env`.
- Set `APP_URL` and `NEXT_PUBLIC_APP_URL` to the public HTTPS origin. Stripe redirects and signed URLs depend on them.
- Set `MAX_UPLOAD_MB` consistently with the reverse-proxy body limit (proxy limit must be equal or greater).
- Configure the Stripe webhook endpoint at `https://<host>/api/v1/webhooks/stripe` for
  `checkout.session.completed`, `customer.subscription.created|updated|deleted` and `invoice.payment_failed`.
  Signature verification uses the raw request body; do not put a body-rewriting proxy in front of it.
- Run at least two web replicas behind the proxy. Workers can scale horizontally; each job is claimed atomically.
- Keep exactly one scheduler (or accept duplicate maintenance calls, which are idempotent).
- Configure log shipping from container stdout (structured JSON). Never ship document contents; the app does not log
  them.

## Migrations and rollback

`prisma migrate deploy` runs in the `migrate` service. Migrations are forward-only. For a failed deployment:

1. Stop web/worker rollout, keep the previous image available.
2. Inspect `prisma migrate status` and application logs.
3. Restore from the pre-deployment backup if a migration is destructive (docs/backup-recovery.md).
4. Never edit an applied migration in place; add a corrective migration.

## Health and readiness

- `GET /health` — liveness only.
- `GET /ready` — database and storage always; Redis and processor are required in production. Returns 503 with a
  non-sensitive `checks` object when not ready.
- `GET /api/v1/health` mirrors the API liveness under the versioned API. The processor exposes `/health`, `/ready` and
  `/metrics`.

Point load-balancer readiness at `/ready`, liveness at `/health`.

## Backups

Automated database backups are mandatory. Object storage must be versioned or backed up on the same schedule. See
[docs/backup-recovery.md](backup-recovery.md).

## Verification after deploy

```bash
curl -fsS https://<host>/health
curl -fsS https://<host>/ready
curl -fsS https://<host>/api/v1/openapi | jq '.openapi'
```

Then sign in, upload one PDF, confirm it reaches `completed` or `needs_review`, download the original and create a CSV
export. Check Stripe test-mode checkout and webhook delivery if billing is enabled.
