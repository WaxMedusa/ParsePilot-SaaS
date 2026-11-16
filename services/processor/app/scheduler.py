"""Maintenance scheduler: `python -m app.scheduler`.

Runs in the worker daemon so retention and reconciliation happen on a fixed
cadence. Both operations are idempotent and anchored by database rows, so the
scheduler does not need a broker to deliver work.
"""

from __future__ import annotations

import logging
import time
import uuid

from .config import get_settings
from .logging import configure_logging, log
from .web_client import WebClient

log = logging.getLogger(__name__)


def main() -> int:
    configure_logging()
    settings = get_settings()
    if not settings.internal_token:
        log.error("scheduler_misconfigured", extra={"fields": {"reason": "INTERNAL_SERVICE_TOKEN is required"}})
        return 2

    client = WebClient()
    last_retention = 0.0
    next_reconcile = 0.0
    log.info("scheduler_started", extra={"fields": {"workerId": settings.worker_id}})

    try:
        while True:
            now = time.monotonic()
            correlation_id = str(uuid.uuid4())

            if now >= next_reconcile:
                try:
                    result = client.reconcile_jobs(correlation_id)
                    log.info("reconcile_completed", extra={"fields": {"result": result}})
                except Exception as error:  # noqa: BLE001
                    log.warning("reconcile_failed", extra={"fields": {"error": type(error).__name__}})
                next_reconcile = now + settings.reconcile_interval_seconds

            if now - last_retention >= settings.scheduler_interval_seconds:
                try:
                    scheduled = client.schedule_retention(correlation_id)
                    job_id = (scheduled or {}).get("jobId")
                    if scheduled and scheduled.get("scheduled") and job_id:
                        client.execute_retention(job_id, settings.worker_id, correlation_id)
                    log.info("retention_completed", extra={"fields": {"scheduled": scheduled}})
                except Exception as error:  # noqa: BLE001
                    log.warning("retention_failed", extra={"fields": {"error": type(error).__name__}})
                last_retention = now

            time.sleep(30)
    except KeyboardInterrupt:
        log.info("scheduler_stopped")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
