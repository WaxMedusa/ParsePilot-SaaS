# Observability

## Health and readiness

| Endpoint | Process | Meaning |
| --- | --- | --- |
| `/health` | web | process is alive; no dependencies |
| `/ready` | web | database + storage always; Redis and processor required in production |
| `/health` | processor | process is alive |
| `/ready` | processor | internal token configured and Redis reachable |
| `/metrics` | processor | Prometheus text counters and uptime |

The web `/ready` response names each dependency (`database`, `storage`, `redis`, `processor`) with latency where
relevant. It never returns credentials, bucket names or stack traces. Alert on 503 for more than two minutes and on
`status: degraded` outside development.

## Logs

Both services emit structured JSON to stdout. Fields include timestamp, level, service, environment and message.
Request-scoped fields include `requestId`, route and status; job-scoped fields include `jobId`, `documentId`, stage,
attempt and duration.

- The edge middleware generates or forwards `x-request-id` and echoes it in responses.
- API errors always include `requestId` in the body. Ask users for it in support requests.
- `correlationId` travels from the web job row into the processor request headers and worker logs.
- Document text, extracted values, tokens, signed URLs and passwords are never logged.

Ship stdout to a log aggregator with retention matching the audit/incident policy. Do not enable debug logging in
production.

## Metrics

Web counters (internal `/api/v1/internal/metrics`) and processor Prometheus counters cover:

- enqueued / enqueue failures and rejected enqueues
- jobs claimed, completed, failed and reconciled
- auth login failures
- retention sweeps and purged objects

Recommended alerts:

| Signal | Threshold |
| --- | --- |
| `/ready` failing | 2 minutes |
| queued jobs older than 10 minutes | any sustained count |
| dead-letter jobs | any increase |
| worker heartbeat missing | 5 minutes |
| processor 5xx / enqueue failures | > 2% over 15 minutes |
| database connections | > 80% of pool |
| storage errors | any sustained increase |

## Queue operations

```bash
# inspect queue depth (Redis)
redis-cli -u "$REDIS_URL" llen "rq:queue:parsepilot"

# inspect failed RQ jobs
redis-cli -u "$REDIS_URL" keys 'rq:job:*'

# re-announce queued database jobs after a Redis flush or worker outage
curl -X POST -H "x-internal-token: $INTERNAL_SERVICE_TOKEN" \
  https://<host>/api/v1/internal/jobs/reconcile
```

The reconciler is the recovery mechanism: PostgreSQL job rows remain `queued`, and the scheduler re-announces them.
RQ retries are disabled deliberately; retry policy, backoff and dead-lettering live in the web job service so they
survive Redis loss.

## Retention scheduler

The scheduler process runs reconciliation every five minutes and the retention sweep hourly. Both are idempotent.
Exactly one scheduler is expected; duplicate calls are safe but waste work.

## What is not included

No hosted APM, tracing backend, paging provider or dashboard is provisioned. Connect your own Sentry/OpenTelemetry
collector if required; the structured logs and request ids are designed to be ingested by one.
