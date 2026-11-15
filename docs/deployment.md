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
