# Security

This page describes what is implemented in the codebase. It deliberately makes no certification or audit claims.
Anything not implemented is listed under known gaps.

## Authentication and sessions

- Email + password with scrypt (N=16384, r=8, p=1), per-hash random salt, timing-safe comparison.
- Password policy: at least 10 characters with lowercase, uppercase and a number; common passwords rejected.
- Session tokens are 32 random bytes, returned once and stored only as SHA-256 hashes.
- Cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production. Absolute lifetime is configured.
- Password reset tokens are single-use, hashed, expire after 60 minutes, and revoke sessions.
- Sessions can be listed and revoked per device from privacy settings.

## Request protection

- `withApi` centralizes authentication, workspace resolution, CSRF, rate limiting, request ids and error envelopes.
- Cookie-authenticated mutations require a double-submit CSRF token (`pp_csrf` cookie and `x-csrf-token` header) and
  an allowed `Origin`. Bearer-token requests are exempt because they are not ambient credentials.
- Rate limits are per user/IP and route, backed by Redis with a safe in-process fallback.
- All SQL access goes through Prisma or parameterized `$queryRaw`; there is no string interpolation of user input.
- Uploads are validated by magic bytes, size and allowed type; active PDF content (JavaScript, launch actions, embedded
  files) is rejected. Storage keys are random UUIDs, never derived from user filenames.
- Downloads are served only through short-lived signed URLs created after a workspace membership check.
- Security headers include CSP, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy, Permissions-Policy,
  COOP and HSTS in production.

## Tenant isolation

- Every document, job, export, usage row and audit entry carries a `workspaceId`.
- Repositories resolve the workspace from the authenticated membership; client-supplied workspace ids are checked
  against `WorkspaceMember`, never trusted directly.
- Internal service endpoints are authenticated with a shared token, are not reachable from the browser, and validate
  that artefact keys stay under the workspace prefix.
- The Vitest integration suite verifies that a document from workspace A is not readable from workspace B.

## Data protection

- PostgreSQL is the source of truth. Backups must be encrypted at rest.
- Object storage is private; no public bucket policy. MinIO is initialized with anonymous access disabled.
- Logs are structured JSON and exclude document text, secrets, session tokens and signed URLs.
- Audit logs record security-relevant actions with actor, workspace, target and request id.
- Export files neutralize spreadsheet formula injection by prefixing values that begin with `=`, `+`, `-`, `@`, tab or
  carriage return.

## Billing and webhooks

- Stripe signatures are verified against the raw body before any processing.
- Event ids are stored uniquely; replayed events are acknowledged without duplicate side effects.
- Subscription state is written only by verified webhooks.

## Known gaps

- No MFA, SSO/SAML or SCIM.
- No email provider: production password reset and notification emails require one.
- No WAF or bot management; put the app behind a provider if needed.
- No dedicated antivirus scanning for uploaded files. Type and structural checks exist, but malware scanning is an
  infrastructure responsibility.
- Rate limiting is Redis-backed but not globally coordinated across regions.
- OCR accuracy and AI extraction are probabilistic; low-confidence documents are routed to review.

## Reporting a vulnerability

The security contact is a required legal placeholder. Until the business configures it, the `/security` page states
that the channel is not yet available rather than inventing an address. Do not disclose vulnerabilities publicly before
a fix is available.

## Verification

```bash
npm test            # password hashing, tenant isolation, ledger idempotency
npm run test:py     # internal endpoint authentication and pipeline validation
npm run typecheck
```
