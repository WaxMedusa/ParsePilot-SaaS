# API

The machine-readable OpenAPI 3.1 document is served at `GET /api/v1/openapi`. A rendered reference is at `/docs/api`.

## Base and envelope

Base path: `/api/v1`. Every JSON response uses:

```json
{ "data": {}, "meta": { "requestId": "…", "page": 1, "pageSize": 20, "total": 42 } }
```

Errors:

```json
{ "error": { "code": "validation_failed", "message": "…", "details": [] }, "requestId": "…" }
```

Always include `requestId` in support requests. The edge middleware generates one if absent and echoes it in the
`x-request-id` response header.

## Authentication

Two options:

1. Session cookie `pp_session` from `POST /auth/login`. Mutations also require the `pp_csrf` cookie value in the
   `x-csrf-token` header.
2. `Authorization: Bearer <session token>` for API clients. This skips CSRF because there is no ambient credential.

Workspace-scoped calls send `x-workspace-id: <uuid>` (or `workspaceId` in the JSON body). Membership is verified on
every request; a caller cannot select a workspace they do not belong to.

## Pagination, sorting, rate limits

- `page` starts at 1; `pageSize` is capped at 100.
- Lists accept `sort` and `order` where documented.
- Authenticated endpoints are rate limited per user and route. `429` responses include `Retry-After`.
- Unknown fields are rejected by schema validation rather than silently ignored.

## Document statuses

`uploaded`, `queued`, `extracting_text`, `running_ocr`, `extracting_fields`, `validating`, `detecting_duplicates`,
`completed`, `needs_review`, `failed`.

`GET /documents/:id/status` is the polling endpoint. Terminal statuses are `completed`, `needs_review` and `failed`.

## Job statuses

`queued`, `running`, `succeeded`, `failed`, `dead_letter`, `cancelled`. A failed job is retried with exponential
backoff and jitter; after `maxAttempts` it is dead-lettered. `POST /documents/:id/retry` creates a new attempt and is
idempotent while an active job exists.

## Main resources

| Resource | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/logout`; `GET /auth/session`; `POST /auth/password-reset/request`, `/confirm` |
| Documents | `GET/POST /documents`; `GET/PATCH/DELETE /documents/:id`; `POST /documents/:id/process`, `/retry`, `/download-url`; `GET /documents/:id/status`; `PATCH /documents/:id/fields/:fieldId` |
| Jobs | `GET /jobs`, `GET /jobs/:id` |
| Exports | `GET/POST /exports`; `GET /exports/:id/download`; `GET /exports/live` (session download); `GET /exports/live/:token` (permanent signed link, no session, rebuilt from current data on every request) |
| Billing | `GET /subscription`, `POST /subscription/checkout`, `POST /subscription/portal`, `GET /usage` |
| Privacy | `GET /privacy/account`, `POST /privacy/requests`, `GET /privacy/requests[/:id/download]`, `DELETE /privacy/sessions/:id`, `POST /privacy/account-deletion`, `/cancel`, `/workspace-deletion`, `POST /privacy/consent` |
| System | `GET /openapi`; `/health` and `/ready` live at the app root |

## Stripe webhook

`POST /webhooks/stripe` is unauthenticated but requires a valid `Stripe-Signature` over the raw body. Events are
deduplicated by Stripe event id. Do not put a body-rewriting proxy in front of this route.

## Internal API

`/api/v1/internal/*` is service-to-service only. It requires `x-internal-token` and must never be exposed to a browser
or the public internet. It is used by the Python processor to claim jobs, report stages/results/failures, build exports
and run retention. The processor's own enqueue endpoint is `POST /internal/jobs` with the same token.
