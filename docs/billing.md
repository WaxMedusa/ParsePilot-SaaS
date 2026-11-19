# Billing

## Plans and entitlements

The `Plan` table is authoritative. The UI never decides limits. `getUsageSnapshot()` and `assertCanProcess()` read the
workspace plan, subscription status and current usage, and reject work before storage when a limit would be exceeded.

Entitlements include monthly pages, maximum upload size and member count. XLSX exports are gated by the plan feature
list for both live and snapshot exports; CSV is available on every plan. `maxWorkspaces` remains an internal database
field but is not a public entitlement because it is not enforced.

Uploads are capped at 4 MB on Free and 10 MB on the paid plans. Documents go straight from the browser to private object storage through a short-lived
presigned PUT, so the Vercel Function only receives JSON and its request-body limit (about 4.5 MB) no longer caps the
file. The API then re-reads the stored object, detects its real type, counts its pages and records the document, so a
direct upload is validated exactly like a multipart one. Uploads that cannot use a presigned URL — local development storage — fall back
to the multipart route and stay within the app host's body limit.

Plan prices are stored in integer cents (`priceCents`), never floats. Stripe price IDs come from environment variables
and are written into the plan seed.

## Page counting

- One ledger entry per **accepted processing job**, written when the job completes successfully.
- The ledger key is `usage:job:<jobId>` with a unique constraint, so duplicate completion callbacks and retries cannot
  double charge.
- A manual reprocess creates a new job and may count again, because the document is genuinely processed again.
- Jobs that never produce an extraction are not charged.
- Uploads use the PDF page tree, not a regex, to count pages before storage. The worker's actual page count is checked
  again against the remaining allowance under a workspace row lock before the ledger is written.
- `UsagePeriod` counters are updated in the same transaction as the ledger entry and reconciled from the ledger for
  display.

## Stripe

- Checkout sessions are created server-side with the workspace and user in metadata.
- The webhook verifies the raw-body signature, stores each event id in `BillingEvent` with a unique constraint, and
  processes it exactly once. Duplicate deliveries are acknowledged without re-applying changes.
- Subscription state changes do not trust client input. The webhook is the only writer of subscription status.
- Failed payments set a grace period (seven days) before processing is blocked. This is implemented in the subscription
  service and surfaced in the billing UI.
- Downgrades and cancellation use the Stripe billing portal.

Without `STRIPE_SECRET_KEY`, checkout and the portal are disabled explicitly in the UI; plan limits still apply.

## Refunds and disputes

There is no automated refund flow. Handle refunds in Stripe, then record the adjustment manually in the billing ledger
only if finance requires it. Do not edit historical usage just to make totals look right; add an auditable adjustment.

## Testing billing

Use Stripe test mode and the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
stripe trigger checkout.session.completed
```

Verify that a replayed event produces no duplicate subscription or ledger change, and that an invalid signature returns
400 without touching the database.
