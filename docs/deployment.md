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

## Vercel (web service and worker daemon)

The root `vercel.json` deploys the web service and a background daemon in one Vercel project:

- `web` is the Next.js app at `apps/web`. Every public route is rewritten to it.
- `worker` is a Vercel Daemon built from `services/processor/Dockerfile.vercel`. It runs the RQ-free worker and
  scheduler under `app.daemon`, pulls jobs from the web internal API, and has no public route.

Import the repository at the **root**, not `apps/web`, so Vercel can read `vercel.json`. Vercel builds each service
separately and installs the npm workspace from the root lockfile. Node.js must be 20.11 or newer. Daemons are in
public beta and run in production only.

Vercel Services does not support Edge Functions. This app therefore has no Edge middleware: the CSRF cookie is issued
by `GET /api/v1/auth/csrf` and bootstrapped in the browser, while the dashboard layout enforces authentication. Do not
reintroduce `src/middleware.ts` or an `export const runtime = 'edge'` route in the `web` service.

Environment variables are shared by the web service and the worker daemon:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL. Use the provider's transaction-pooler URL for serverless functions. |
| `SESSION_SECRET`, `DOWNLOAD_SIGNING_SECRET`, `INTERNAL_SERVICE_TOKEN` | Independent 32-byte random values. |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | Public HTTPS origin. If omitted, the app falls back to Vercel's deployment URL. |
| `OBJECT_STORAGE_DRIVER=supabase` plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Private Supabase Storage. The service-role key is server-only and must never be exposed to the browser. The bucket must allow `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `application/json` alongside the document types, or CSV/XLSX/data exports fail. Do not set `STORAGE_DRIVER` on Vercel: Buildah reserves that name for its container-storage driver. |
| `OBJECT_STORAGE_DRIVER=s3` plus `S3_*` | Alternative private S3-compatible storage. Vercel functions have a read-only filesystem apart from `/tmp`, so local storage is not usable there. |
| `QUEUE_DRIVER=database` | Default. PostgreSQL is the queue; the worker polls the internal API. No Redis required. |
| `REDIS_URL` | Only for the legacy `QUEUE_DRIVER=redis` RQ mode. |
| `SETTINGS_ENCRYPTION_KEY` | 32-byte random value (64 hex characters) that encrypts AI provider keys saved per workspace in Settings → AI extraction. Without it the dashboard cannot save a key; extraction continues with the deployment default. |
| `AI_API_KEY` / `AI_*` | Optional deployment-wide default. Workspace owners and admins can save their own provider key, URL and model in Settings → AI extraction; that setting takes precedence for the workspace's jobs, and without either source the deterministic rules are used. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Only when billing is enabled. |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN` | Transactional email for password reset, email verification and invitations. Set `EMAIL_PROVIDER=resend` or `postmark`, verify the sending domain, and keep the API key server-side. `EMAIL_REPLY_TO` is optional. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL and publishable/anon key for Google sign-in. Never use `service_role` here. |

The long-running **worker** and **scheduler** run in the `worker` Vercel Daemon declared in `vercel.json`; it uses
`services/processor/Dockerfile.vercel` and runs both processes under `app.daemon`. In database mode the daemon needs
only `INTERNAL_SERVICE_TOKEN` and its `WEB_INTERNAL_URL` binding to the `web` service: it polls
`/api/v1/internal/jobs/next` and claims each job atomically. The worker also needs `AI_*`/OCR configuration; the image
includes Tesseract. Without a worker, uploads remain queued but never finish. The separate FastAPI processor service
is only needed for legacy Redis/RQ deployments.

Run migrations from CI or a workstation, not from the Vercel build:

```bash
DATABASE_URL='postgresql://...' npx prisma migrate deploy --schema apps/web/prisma/schema.prisma
```

Seed the public plans once; the marketing pricing section falls back to the catalogue defaults when the database is
unavailable, but checkout needs the seeded rows.

### Transactional email

Password reset, email verification and workspace invitations use a transactional email provider. The app supports
Resend and Postmark over their HTTP APIs and does not require an SDK. Set `EMAIL_PROVIDER`, `EMAIL_FROM` and the matching
server API key in Vercel. Verify the sending domain with the provider (SPF, DKIM and DMARC) before launch.

Team invitations can always be copied from Team settings if delivery fails, but production password reset and email
verification require a working provider. After configuring the provider, test one reset, one verification and one
invitation with real mailboxes rather than relying on the preview logs.

### Supabase Auth (Google sign-in)

Supabase is the Google identity broker; ParsePilot still owns local users, workspaces, permissions and sessions. The
browser completes the Google handshake with Supabase, then posts the Supabase access token to
`/api/v1/auth/supabase`. The server verifies that token with Supabase, requires a confirmed email, finds or creates the
local user, and issues the normal `pp_session` cookie. Existing email/password accounts keep working and are linked by
their verified email on first Google sign-in.

Environment changes require a new deployment. `NEXT_PUBLIC_*` values are baked into the browser bundle and CSP at build
time, so saving them in Vercel does not change an existing deployment; push a commit or use **Redeploy**.

Set these public values in Vercel and locally (they are safe to expose):

- `NEXT_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the project's publishable/anon key (never `service_role`)

In Supabase **Authentication → URL Configuration**, set the Site URL to the public app origin and allow both
`https://<public-origin>/auth/callback` and `http://localhost:3000/auth/callback`.

When using Supabase as the OAuth broker, the Google Cloud OAuth client's **Authorized redirect URI** must be the
Supabase callback, not the ParsePilot callback:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

The ParsePilot callback after Supabase returns control is `https://<public-origin>/auth/callback`.

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
- Set `MAX_UPLOAD_MB` consistently with the reverse-proxy body limit (proxy limit must be equal or greater). On Vercel, keep it at `4`: Function request bodies above roughly 4.5 MB are rejected before the app runs. Larger uploads require direct-to-storage uploads or a different host.
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
