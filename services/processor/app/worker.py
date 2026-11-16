"""Database-polling worker entrypoint: `python -m app.worker`.

PostgreSQL is the queue. The worker asks the web service for the oldest
eligible queued job, then the existing claim endpoint atomically moves it to
`running`. A queue outage therefore cannot lose a document: the row remains
queued and is picked up on the next poll.
"""

from __future__ import annotations

import logging
import signal
import sys
import time

from .config import get_settings
from .logging import configure_logging
from .tasks import execute_job
from .web_client import WebClient

log = logging.getLogger(__name__)


def main() -> int:
    configure_logging()
    settings = get_settings()
    if not settings.internal_token:
        log.error("worker_misconfigured", extra={"fields": {"reason": "INTERNAL_SERVICE_TOKEN is required"}})
        return 2

    stopping = False

    def request_stop(_signum: int, _frame: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)

    client = WebClient()
    log.info(
        "worker_started",
        extra={
            "fields": {
                "workerId": settings.worker_id,
                "mode": "database",
                "pollIntervalSeconds": settings.poll_interval_seconds,
            }
        },
    )
    try:
        while not stopping:
            try:
                job_id = client.next_job()
                if not job_id:
                    time.sleep(settings.poll_interval_seconds)
                    continue
                log.info("worker_job_polled", extra={"fields": {"jobId": job_id}})
                execute_job(job_id)
            except Exception as error:  # noqa: BLE001 - keep the worker alive across API outages
                log.error(
                    "worker_poll_failed",
                    extra={"fields": {"error": type(error).__name__}},
                )
                time.sleep(min(30, max(1, settings.poll_interval_seconds * 2)))
    except KeyboardInterrupt:
        pass
    finally:
        client.close()

    log.info("worker_stopped", extra={"fields": {"workerId": settings.worker_id}})
    return 0


if __name__ == "__main__":
    sys.exit(main())
