# Incident response

Contact details are intentionally placeholders until the business supplies them. Fill them in `src/config/legal.ts`
and in the on-call system; do not invent addresses or phone numbers.

## Severity

| Severity | Examples | Response target |
| --- | --- | --- |
| SEV-1 | confirmed data breach, cross-tenant exposure, destructive data loss, payment outage | acknowledge in 15 min, incident commander, notify leadership |
| SEV-2 | processing pipeline down, widespread failed uploads, billing webhooks failing | acknowledge in 1 hour |
| SEV-3 | single-tenant issue, degraded export generation, elevated error rate | next business day |

## First 30 minutes

1. **Acknowledge and open a channel.** Assign an incident commander and a scribe. Record UTC timestamps.
2. **Assess scope.** Which environment, tenants, data categories and integrations are affected? Do not speculate in
   writing; state what is confirmed.
3. **Contain.** Revoke leaked sessions (`Session.revokedAt`), rotate secrets, disable a compromised integration, or
   remove a bad deployment. Prefer reversible containment.
4. **Preserve evidence.** Copy relevant structured logs (request ids, job ids, audit entries) before rotation. Never
   copy document contents into chat or tickets.
5. **Communicate.** Status page and affected customers when confirmed. Do not claim a cause before verification.

## Data breach

- Notify the privacy contact and legal counsel immediately.
- GDPR-style regimes generally require notifying the supervisory authority within 72 hours of becoming aware, where the
  breach is likely to result in a risk to individuals. This is a prompt to get legal advice, not legal advice.
- Document: nature of the breach, categories and approximate volume of data, likely consequences, measures taken.
- Preserve the audit log and relevant database rows. Do not delete evidence to "clean up".

## Useful commands

```bash
# revoke all sessions for a user (run in a controlled Prisma script)
# update "Session" set "revokedAt" = now() where "userId" = '<uuid>' and "revokedAt" is null;

# inspect readiness without exposing secrets
curl -s https://<host>/ready | jq '.checks'

# job state
psql "$DATABASE_URL" -c "select status, count(*) from \"ProcessingJob\" group by 1 order by 2 desc;"
```

## Recovery and postmortem

- Confirm the fix with the affected path, not just a healthy process.
- Replay dead-letter jobs through the UI or `POST /api/v1/documents/:id/retry`.
- Reconcile jobs and check usage ledger counts for double charges.
- Hold a blameless postmortem within five business days: timeline, impact, detection gap, contributing factors,
  corrective actions with owners and dates.

## Security disclosure

The security contact is a required placeholder (`securityEmail`). Until it is configured, the `/security` page says so
explicitly. Do not publish an email address that does not exist.
