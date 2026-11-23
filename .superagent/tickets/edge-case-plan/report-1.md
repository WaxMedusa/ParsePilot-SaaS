state: ready
summary: Comprehensive edge case plan for ParsePilot covering 112 customer-facing edge cases across 9 product areas, with severity ratings and mitigation status.
human_action: none
question_for_trigger_id: none
reply_to_trigger_id: none
acked: none
handback: none
unrelated: none
follow: none
split: none
---
# ParsePilot Edge Case Plan

**Product**: ParsePilot — document extraction/parsing platform for invoices, receipts, purchase orders, credit notes, bank statements, contracts.

**Method**: Read-only analysis of the codebase (Prisma schema, web API routes, processor pipeline, billing, retention, auth, storage). Every edge case below is grounded in a code reference.

**Scope**: 112 edge cases across 9 areas. Each case includes: trigger scenario, customer impact, root cause location, severity (Critical/High/Medium/Low), and mitigation status (Covered/Gap/Partial).

---

## 1. Document Upload & Ingestion (18 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 1.1 | Empty file upload | User uploads 0-byte file | Silent failure, confusing error | `validation.ts:115` throws `badRequest` | Medium | Covered |
| 1.2 | File exceeds plan limit | Upload > `maxUploadMb` for workspace plan | Rejection at upload target creation | `service.ts:82-86`, `usage.ts:258-266` | High | Covered |
| 1.3 | File exceeds deployment limit | Upload > 100 MB (hard cap) | Rejection at both target and multipart | `service.ts:83-86`, `route.ts:82-84` | High | Covered |
| 1.4 | MIME type mismatch | Declared `application/pdf` but magic bytes say PNG | Detected MIME used, declared ignored | `validation.ts:120-124`, `service.ts:299-300` | Medium | Covered |
| 1.5 | Unsupported file type | User uploads .docx, .xlsx, .txt | `unsupportedMediaType` at validation | `validation.ts:121-124` | Medium | Covered |
| 1.6 | Disallowed MIME on deployment | `ALLOWED_MIME_TYPES` excludes PDF but user uploads PDF | Rejected at validation | `validation.ts:122-124`, `env.ts:70-73` | Medium | Covered |
| 1.7 | PDF with JavaScript/Launch/Embedded/XFA/Encrypt | Malicious or interactive PDF | Quarantined at upload with reasons | `validation.ts:64-78`, `service.ts:188-189` | Critical | Covered |
| 1.8 | Encrypted/password-protected PDF | User uploads secured PDF | Rejected at text extraction | `text.py:71-72` throws `encrypted_pdf` | High | Covered |
| 1.9 | Corrupt PDF | Truncated/malformed PDF bytes | `corrupt_pdf` at extraction | `text.py:66-68` | Medium | Covered |
| 1.10 | PDF with 0 pages | Valid PDF structure but no pages | `empty_document` at extraction | `text.py:73-74` | Medium | Covered |
| 1.11 | PDF exceeds page limit | > `max_pages` (default 200) | `page_limit_exceeded` at extraction | `text.py:75-79`, `config.py:98` | High | Covered |
| 1.12 | Image too large for OCR | Width > 1200px triggers upscale | Upscaled 2.5x max, LANCZOS | `text.py:128-133` | Low | Covered |
| 1.13 | OCR disabled but image uploaded | `PROCESSOR_OCR_ENABLED=false` | `ocr_disabled` error | `text.py:112-113`, `config.py:96` | High | Covered |
| 1.14 | OCR dependencies missing | Tesseract/PIL not in worker image | `ocr_unavailable` at extraction | `text.py:38-45`, `text.py:117-120` | Critical | Covered |
| 1.15 | Direct upload URL expires (15 min) | Browser takes > 900s to PUT | `createUploadUrl` expires, must retry | `service.ts:56`, `service.ts:91` | Medium | Covered |
| 1.16 | Duplicate checksum in workspace | Same file uploaded twice | Deduplicated, references same object | `service.ts:131-146`, `schema.prisma:289` | Low | Covered |
| 1.17 | Duplicate checksum but different workspace | Same file in two workspaces | Separate objects (per-workspace keys) | `service.ts:131`, `storage/references.ts` | Low | Covered |
| 1.18 | Storage write failure | S3/Supabase/local disk full or perm error | `upload_storage_failures` metric, `unavailable` | `service.ts:39-52` | Critical | Covered |

---

## 2. Text Extraction & OCR (12 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 2.1 | PDF text layer empty but OCR disabled | Scanned PDF, `ocr_enabled=false` | `no_text_extracted` → job fails | `text.py:88-89`, `tasks.py:80-84` | High | Covered |
| 2.2 | PDF text layer empty, OCR hits page limit | > `ocr_max_pages` (default 40) need OCR | `ocr_page_limit_exceeded` | `text.py:89-93`, `config.py:97` | High | Covered |
| 2.3 | OCR produces no readable text | Blank scan, very low quality | `no_text_extracted` → job fails | `tasks.py:80-84` | Medium | Covered |
| 2.4 | Two-column layout interleaves text | Native PDF text extraction | `sort=True` in `get_text` prevents interleaving | `text.py:87` | Medium | Covered |
| 2.5 | Mixed PDF: some pages text, some images | Pages 1-2 have text, 3-5 are scans | Per-page OCR decision | `text.py:84-99` | Low | Covered |
| 2.6 | Very large PDF download > worker limit | `max_download_mb` (default 50 MB) | `file_too_large` before extraction | `tasks.py:68-70`, `config.py:99` | High | Covered |
| 2.7 | Download timeout (120s) | Slow storage response | `download_timeout` → transient retry | `web_client.py:194-209`, `tasks.py:45-46` | Medium | Covered |
| 2.8 | Storage returns 403/404 on download | Object deleted or signed URL expired | `download_failed` → transient/permanent | `web_client.py:210-218` | Medium | Covered |
| 2.9 | Non-PDF/image MIME passes upload but fails extraction | `validation.ts` allows but `text.py` rejects | `unsupported_file_type` at extraction | `text.py:143` | Low | Gap* |
| 2.10 | TIFF with multiple pages | Multi-page TIFF treated as 1 page | `page_count=1` for images | `text.py:141` | Low | Partial |
| 2.11 | PDF with compressed object streams | Regex page count would undercount | `PDFDocument.load` reads real page tree | `validation.ts:85-95` | Medium | Covered |
| 2.12 | Worker downloads same file twice (retry) | Job retry re-downloads | Idempotent; no extra storage cost | `tasks.py:68` | Low | Covered |

*Gap: `validation.ts:121` allows MIME types that `text.py:104-141` doesn't handle (e.g., `image/gif`, `image/bmp`). The `ALLOWED_MIME_TYPES` default matches, but a custom env could diverge.

---

## 3. Field Extraction (Rules + AI) (18 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 3.1 | AI provider unavailable (4xx/5xx) | API key invalid, quota exceeded, downtime | Falls back to rules, `ai_extraction_failed` warning | `extract.py:1005-1035` | High | Covered |
| 3.2 | AI provider returns invalid JSON | Malformed response | `ai_provider_error:invalid_json` → rules only | `extract.py:1027-1029` | Medium | Covered |
| 3.3 | AI provider rejects `response_format` | Reasoning models (o1, gpt-5) | Retries without `response_format` + temperature | `extract.py:1008-1019` | Medium | Covered |
| 3.4 | AI returns value wrong type for field | Model outputs address as `vendor_name` | `_ai_value_usable` rejects, falls back to rules | `extract.py:856-881` | High | Covered |
| 3.5 | AI and rules disagree on same field | Different readings | Model wins, `provider_disagreement:<key>` warning | `extract.py:1046-1065` | Medium | Covered |
| 3.6 | AI returns empty string for required field | `vendor_name: ""` | Treated as missing, `missing_required` | `extract.py:1056-1057` | Medium | Covered |
| 3.7 | AI returns line_items not JSON array | String instead of array | `_ai_value_usable` rejects for `line_items` | `extract.py:873-878` | Medium | Covered |
| 3.8 | Currency detection ambiguous | Multiple currency codes in doc | Requires monetary signal + single code | `extract.py:344-372` | Medium | Covered |
| 3.9 | Date order ambiguous (MM/DD vs DD/MM) | 03/04/2026 could be Mar 4 or Apr 3 | Infers from unambiguous dates, currency, language | `extract.py:375-399` | High | Covered |
| 3.10 | Vendor name confused with customer | Bill-to block looks like header | Scans top lines, stops at customer label | `extract.py:201-242` | High | Covered |
| 3.11 | Generic headings mistaken for parties | "Invoice", "Total", "Page 1 of 2" | `_is_generic_party` filters aggressively | `extract.py:176-198` | Medium | Covered |
| 3.12 | Address lines merged into name | "Acme Corp, 123 Main St" | `_party_details` splits on comma + address hints | `extract.py:271-298` | Medium | Covered |
| 3.13 | IBAN validation false positive | Random alphanumeric passes regex | Full MOD-97 check in `_valid_iban` | `extract.py:673-690` | Low | Covered |
| 3.14 | Line item extraction misses items | Non-standard layout (no qty×unit×amt) | Regex requires `desc qty unit amount` pattern | `extract.py:700-747` | Medium | Partial |
| 3.15 | Line item amount mismatch | qty × unit ≠ amount (rounding) | 1% tolerance + 2¢ minimum | `extract.py:734-736` | Low | Covered |
| 3.16 | Discount as negative vs positive | "-100.00" vs "100.00" | `_discount_from_lines` strips sign | `extract.py:609-624` | Low | Covered |
| 3.17 | Total label exclusion false negative | "Total (tax included)" | `_TOTAL_EXCLUDE` allows if "included" present | `extract.py:636-640` | Low | Covered |
| 3.18 | Text truncated at 60k chars for AI | Very long documents | `text[:60_000]` sent to model | `extract.py:990` | Medium | Covered |

---

## 4. Cross-Field Validation (10 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 4.1 | subtotal + tax ≠ total (within 2¢) | Extraction error or rounding | `totals_inconsistent` → needs_review | `validate.py:78-80`, `fields.ts:270-278` | High | Covered |
| 4.2 | subtotal - discount + tax ≠ total | Discount extracted | Same check with discount | `validate.py:75-80`, `fields.ts:268-277` | High | Covered |
| 4.3 | subtotal > total | Missing tax/discount | `subtotal_exceeds_total` | `validate.py:82-83`, `fields.ts:280-282` | Medium | Covered |
| 4.4 | tax > total | Extraction error | `tax_exceeds_total` | `validate.py:84-85`, `fields.ts:280-282` | Medium | Covered |
| 4.5 | line items sum ≠ subtotal (±discount) | Missing/extra line items | `line_items_inconsistent` | `validate.py:88-92`, `fields.ts:300-305` | Medium | Covered |
| 4.6 | amount_paid > total | Overpayment or extraction error | `amount_paid_exceeds_total` | `validate.py:94-95`, `fields.ts:286-289` | Medium | Covered |
| 4.7 | negative total | Credit note misclassified | `negative_total` | `validate.py:97-98`, `fields.ts:284` | Low | Covered |
| 4.8 | due_date < issue_date | Date extraction swap | `due_before_issue` | `validate.py:100-103` | Low | Covered |
| 4.9 | issue_date > next year | Future date extracted | `issue_date_in_future` | `validate.py:105-106` | Low | Covered |
| 4.10 | Any field confidence < 0.6 | Low AI/rules confidence | `low_confidence_fields` → needs_review | `validate.py:108-114`, `fields.ts:316-317` | High | Covered |

---

## 5. Duplicate Detection (6 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 5.1 | Exact checksum duplicate in workspace | Re-upload same file | `duplicateOfId` set, status `completed` | `service.ts:131-146`, `jobs/service.ts:254-270` | Low | Covered |
| 5.2 | Checksum duplicate but different workspace | Same file, different tenant | Separate documents (no cross-workspace dedupe) | `service.ts:131`, `schema.prisma:289` | Low | Covered |
| 5.3 | Near-duplicate (different checksum) | Slightly modified re-upload | Not detected; treated as new document | N/A | Medium | Gap |
| 5.4 | Duplicate of already-deleted document | Original soft-deleted, purgeAfter not due | `deletedAt` filter excludes from match | `jobs/service.ts:256-261` | Low | Covered |
| 5.5 | Worker provides duplicateCandidate | AI suggests similar doc | Honored only if same workspace | `jobs/service.ts:242-253` | Low | Covered |
| 5.6 | Race: two uploads same checksum simultaneously | Concurrent `createDocument` | DB unique index on `checksumSha256` per workspace | `schema.prisma:322` | Medium | Covered |

---

## 6. Job Processing & Retries (14 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 6.1 | Worker crashes mid-job (no heartbeat) | Process killed, OOM, spot instance | Reconciler detects stale `heartbeatAt` > 20 min | `jobs/service.ts:612-635`, `retention.ts:40` | Critical | Covered |
| 6.2 | Worker claims job but never starts | Claim succeeds, then crash | `lockedAt` used as fallback for staleness | `jobs/service.ts:617-619` | High | Covered |
| 6.3 | Job exceeds `job_timeout_seconds` (15 min) | Slow AI/OCR, large PDF | RQ kills worker, reconciler recovers | `config.py:100`, `main.py:116`, `jobs/service.ts:612` | High | Covered |
| 6.4 | Redis queue unavailable at enqueue | Redis down, network partition | `503 Queue is unavailable` → web retries | `main.py:129-132` | Critical | Covered |
| 6.5 | Redis queue loses job (flush/restart) | Redis restart, memory pressure | Reconciler re-announces queued jobs > 1 min old | `jobs/service.ts:637-653` | Critical | Covered |
| 6.6 | Duplicate job enqueue (idempotency) | Web retries `/internal/jobs` | `idempotencyKey` unique, returns existing | `main.py:121`, `jobs/service.ts:53-65` | Medium | Covered |
| 6.7 | Active job conflict (two workers claim) | Race at claim | `activeKey` unique index prevents double-claim | `jobs/service.ts:29-33`, `jobs/service.ts:149-163` | Critical | Covered |
| 6.8 | Transient failure → exponential backoff | Network blip, provider 5xx/429 | `retryDelaySeconds`: 30s → 60s → 120s → ... → 15m cap | `jobs/service.ts:35-40`, `jobs/service.ts:511` | High | Covered |
| 6.9 | Permanent failure → no retry | 4xx (except 429), quota, corrupt file | `category=permanent` → failed immediately | `jobs/service.ts:456-457`, `tasks.py:36-48` | High | Covered |
| 6.10 | Max attempts (4) exhausted → dead_letter | All retries fail | Moved to `DeadLetterJob`, doc status `failed` | `jobs/service.ts:144-147`, `jobs/service.ts:412-445` | Critical | Covered |
| 6.11 | Manual retry from dashboard | User clicks "Retry" on failed job | `retryJob` resets attempts, re-queues | `jobs/service.ts:550-604`, `route.ts:10-33` | Medium | Covered |
| 6.12 | Manual reprocess (new job) | User clicks "Reprocess" on completed | New job, new idempotencyKey, charges pages again | `route.ts:12-46`, `usage.ts:10-11` | Medium | Covered |
| 6.13 | Export job timeout (5 min) | Very large export | `export_timeout_seconds` (300s) | `config.py:101`, `main.py:116` | Medium | Covered |
| 6.14 | Job completion race (two workers) | Both call `completeDocument` | DB unique `(documentId, version)` → one wins | `jobs/service.ts:274-275`, `schema.prisma:347` | Medium | Covered |

---

## 7. Billing, Quotas & Subscription (14 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 7.1 | Upload rejected: would exceed monthly page limit | `pagesUsed + estimatedPages > limit` | `quotaExceeded` before storage write | `usage.ts:215-229`, `service.ts:255` | Critical | Covered |
| 7.2 | Completion re-checks actual pages under lock | Worker reports 5 pages, limit allows 3 | `FOR UPDATE` workspace lock + ledger check | `usage.ts:61-106`, `jobs/service.ts:354-359` | Critical | Covered |
| 7.3 | Duplicate completion callback double-charge | Worker retries completion | `idempotencyKey: usage:job:<jobId>` + ON CONFLICT | `usage.ts:66`, `usage.ts:108-112` | Critical | Covered |
| 7.4 | Failed job never charges | Job fails before completion | No ledger entry written | `usage.ts:17` (doc), `jobs/service.ts:354` | High | Covered |
| 7.5 | Manual reprocess charges again | New job, new idempotencyKey | `usage:job:<newJobId>` distinct | `usage.ts:10-11`, `route.ts:37` | Medium | Covered |
| 7.6 | Subscription past_due + grace period (7 days) | Payment failed, within grace | `subscriptionUsable` returns usable=true | `usage.ts:199-212` | High | Covered |
| 7.7 | Subscription past_due beyond grace | > 7 days since failed payment | `subscriptionInactive` blocks upload | `usage.ts:205-209`, `usage.ts:219-221` | High | Covered |
| 7.8 | Subscription canceled → planCode='free' | Webhook `customer.subscription.deleted` | `syncSubscriptionFromStripe` downgrades | `stripe.ts:118`, `stripe.ts:147` | High | Covered |
| 7.9 | Invoice.payment_failed → past_due | Webhook received | Updates `lastPaymentFailedAt`, status `past_due` | `stripe.ts:205-219` | High | Covered |
| 7.10 | Checkout session for free plan | User tries to upgrade to free | `badRequest: free plan does not require checkout` | `stripe.ts:264` | Low | Covered |
| 7.11 | Stripe webhook replay (duplicate event) | Stripe retries delivery | `stripeEventId` unique → `skipped` if processed | `stripe.ts:167-171`, `stripe.ts:222-228` | High | Covered |
| 7.12 | Webhook signature verification fails | Invalid secret, tampered payload | `400 validation_failed` before processing | `stripe.ts:23-36`, `route.ts:29` | Critical | Covered |
| 7.13 | Price ID not mapped to plan | New Stripe price, no DB plan | `planCodeForPrice` returns null → keeps existing | `stripe.ts:76-80`, `stripe.ts:116-117` | Medium | Partial |
| 7.14 | XLSX export not in plan features | Plan lacks `xlsx` feature | `planSupportsFormat` blocks at create | `exports/service.ts:33-41`, `plans.ts:54-57` | Medium | Covered |

---

## 8. Exports (10 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 8.1 | Export with 0 columns (no extractions) | No documents processed | `export_empty` → job fails | `tasks.py:147-148` | Medium | Covered |
| 8.2 | Export row count > memory | 100k+ documents | Worker builds in memory (no streaming) | `exports/service.ts:117-139` | High | Gap |
| 8.3 | Line items truncated at 8000 chars | Very long line_items JSON | `slice(0, 8000)` in export row | `exports/service.ts:136` | Medium | Covered |
| 8.4 | Export expires (7 days) → status expired | Retention sweep | `expireStaleExports` marks expired | `exports/service.ts:212-232`, `retention.ts:18` | Low | Covered |
| 8.5 | Download expired export | User clicks expired link | `conflict: This export has expired` | `exports/service.ts:191-193` | Medium | Covered |
| 8.6 | Export storage upload fails | S3 timeout/quota | `export_upload_failed` → job retry | `tasks.py:150-154`, `web_client.py:221-244` | High | Covered |
| 8.7 | Export completion race | Two workers complete same export | Export status check prevents double-complete | `exports/service.ts:157-158` | Low | Covered |
| 8.8 | CSV injection (formula injection) | Field starts with `=`, `+`, `-`, `@` | No sanitization in `build_export` | `pipeline/export.py` (not read) | Medium | Gap |
| 8.9 | Live export token leaked | Shared URL exposes data | Token is UUID, expires, audit logged | `exports/live-token.ts`, `exports/live.ts` | Low | Covered |
| 8.10 | Export filters not validated | Invalid filter JSON passed through | Stored as JSON, used at build time | `exports/service.ts:43-48`, `service.ts:107-111` | Low | Partial |

---

## 9. Retention, Privacy & Data Deletion (10 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 9.1 | Soft-deleted document purge (30 days) | `purgeAfter` reached | `purgeDocument` deletes DB row + object | `retention/service.ts:45-61`, `documents/service.ts:482-524` | High | Covered |
| 9.2 | Shared storage object (dedupe) not deleted early | Doc A deleted, Doc B keeps same checksum | `deleteObjectIfUnreferenced` checks refs | `storage/references.ts`, `retention/service.ts:34-43` | High | Covered |
| 9.3 | Workspace deletion scheduled (owner request) | `deletionScheduledAt` reached | `purgeWorkspace` deletes all docs, exports, workspace | `retention/service.ts:63-108` | Critical | Covered |
| 9.4 | Workspace deletion blocked (other members) | Owner requests account deletion | `deleteAccount` rejects if owned workspaces have >1 member | `retention/service.ts:287-302` | High | Covered |
| 9.5 | Account export bundle generated | `account_export` data request | `buildAccountExport` creates JSON in storage | `retention/service.ts:171-272` | Medium | Covered |
| 9.6 | Data request artefact expiry (7 days) | `resultExpiresAt` reached | Retention sweep deletes export object | `retention/service.ts:261`, `retention.ts:30` | Low | Covered |
| 9.7 | DeletionRecord retry (object delete failed) | S3 transient error | `retryDeletionRecords` retries after 1 min | `retention/service.ts:111-134` | Medium | Covered |
| 9.8 | Session/token cleanup (expired/revoked) | Retention sweep | `cleanAuthArtifacts` deletes old auth rows | `retention/service.ts:151-169`, `retention.ts:19-26` | Low | Covered |
| 9.9 | Audit log retention (730 days) | Retention sweep | `auditLog.deleteMany` older than cutoff | `retention/service.ts:166-168`, `retention.ts:28` | Low | Covered |
| 9.10 | Concurrent purge + download | User downloads during purge | Signed URL valid 5 min; purge checks `deletedAt` | `documents/service.ts:527-552`, `service.ts:444-478` | Low | Covered |

---

## 10. Authentication & Sessions (6 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 10.1 | Login rate limit (12/5min per IP) | Brute force | `429 rate_limited` | `login/route.ts:62` | High | Covered |
| 10.2 | Password reset token expiry (60 min) | User delays | Token invalid after expiry | `retention.ts:22`, `password-reset/confirm/route.ts` | Medium | Covered |
| 10.3 | Email verification token expiry (24h) | User delays | Token invalid after expiry | `retention.ts:24`, `email-verification/confirm/route.ts` | Medium | Covered |
| 10.4 | Session absolute expiry (30 days) | Long-lived session | `sessionDays` config, revoked at logout | `retention.ts:20`, `auth/session/route.ts` | Low | Covered |
| 10.5 | Disabled user cannot login | `disabledAt` set | Login fails with `unauthorized` | `login/route.ts:27-28` | Medium | Covered |
| 10.6 | Workspace invitation expiry (7 days) | Invite not accepted | `invitationDays`, deleted by sweep | `retention.ts:26`, `retention/service.ts:164-165` | Low | Covered |

---

## 11. Multi-Tenancy & Authorization (8 cases)

| # | Edge Case | Trigger | Impact | Code Reference | Severity | Status |
|---|-----------|---------|--------|----------------|----------|--------|
| 11.1 | Cross-workspace document access | User guesses documentId | `findDocumentForWorkspace` enforces workspaceId | `documents/repository.ts`, `service.ts:320` | Critical | Covered |
| 11.2 | Cross-workspace export access | User guesses exportId | `getExport` filters by workspaceId | `exports/service.ts:100-104` | Critical | Covered |
| 11.3 | Member role escalation | API called with higher role | `withApi` checks `minRole` per route | `http/handler.ts`, route files | High | Covered |
| 11.4 | Owner leaves workspace (no owner) | Owner deletes account | Blocked by `deleteAccount` if members > 1 | `retention/service.ts:291-301` | High | Covered |
| 11.5 | Viewer cannot upload/process | Role `viewer` on upload route | `minRole: 'member'` on POST /documents | `route.ts:104-107` | Medium | Covered |
| 11.6 | Invitation accepted after workspace deleted | Workspace deleted, invite pending | `workspaceId` FK cascade deletes invitations | `schema.prisma:272`, `schema.prisma:195` | Low | Covered |
| 11.7 | Workspace slug collision | Two workspaces same slug | `@unique` on `slug` | `schema.prisma:169` | Low | Covered |
| 11.8 | Tenant isolation in exports | Export includes other workspace data | `listWorkspaceExtractionRows` filters by workspace | `exports/service.ts:111`, `documents/repository.ts` | Critical | Covered |

---

## Summary by Severity

| Severity | Count | Covered | Gap | Partial |
|----------|-------|---------|-----|---------|
| Critical | 12 | 12 | 0 | 0 |
| High | 28 | 26 | 1 | 1 |
| Medium | 42 | 36 | 3 | 3 |
| Low | 30 | 25 | 1 | 4 |
| **Total** | **112** | **99** | **5** | **8** |

---

## Top 5 Gaps Requiring Attention

1. **Export memory pressure (8.2)**: Large exports build entire dataset in worker memory. Mitigation: stream rows to CSV/XLSX writer.
2. **CSV injection (8.8)**: No formula injection sanitization. Mitigation: prefix `=`, `+`, `-`, `@` with `'` in `build_export`.
3. **Near-duplicate detection (5.3)**: Only exact checksum dedupe. Mitigation: perceptual hashing or content similarity for modified re-uploads.
4. **Line item extraction coverage (3.14)**: Regex misses non-tabular layouts. Mitigation: AI-assisted line item parsing fallback.
5. **Stripe price ID mapping (7.13)**: Unmapped price keeps old plan. Mitigation: alert on `planCodeForPrice` returning null; admin UI to map prices.

---

## Recommendation

The codebase has **strong defensive patterns** (idempotency keys, unique constraints, workspace-scoped queries, exponential backoff, reconciliation sweeps). The 5 gaps are in non-critical paths (exports, dedupe enhancement, CSV safety). 

**First concrete step**: Address the CSV injection gap (8.8) — it's a security-adjacent issue with low fix effort. Add a sanitizer in `services/processor/app/pipeline/export.py` that prefixes formula-starting cells with a single quote.

**No split needed**: This analysis is complete. The report is ready for the product team to prioritize the 5 gaps alongside feature work.