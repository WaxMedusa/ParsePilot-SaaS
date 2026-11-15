"""RQ worker entrypoint: `python -m app.worker`."""

from __future__ import annotations

import logging
import signal
import sys

import redis
from rq import Queue, Worker

from .config import get_settings
from .logging import configure_logging, log

log = logging.getLogger(__name__)


def main() -> int:
    configure_logging()
    settings = get_settings()
    if not settings.internal_token:
        log.error("worker_misconfigured", extra={"fields": {"reason": "INTERNAL_SERVICE_TOKEN is required"}})
        return 2

    connection = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=5, socket_timeout=30)
    try:
        connection.ping()
    except redis.RedisError:
        log.error("worker_redis_unavailable", extra={"fields": {"redis": settings.redis_url.split("@")[-1]}})
        return 3

    queue = Queue(settings.queue_name, connection=connection)
    worker = Worker([queue], connection=connection, name=settings.worker_id)
    signal.signal(signal.SIGTERM, lambda *_: worker.request_stop(signum=signal.SIGTERM))
    signal.signal(signal.SIGINT, lambda *_: worker.request_stop(signum=signal.SIGINT))
    log.info("worker_started", extra={"fields": {"workerId": settings.worker_id, "queue": settings.queue_name}})
    worker.work(with_scheduler=False)
    log.info("worker_stopped", extra={"fields": {"workerId": settings.worker_id}})
    return 0


if __name__ == "__main__":
    sys.exit(main())
