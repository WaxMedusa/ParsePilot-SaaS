"""FastAPI surface of the processing service.

Only three responsibilities live here: enqueue a durable job id into Redis,
report process health, and expose basic metrics. All document work happens in
the RQ worker process.
"""

from __future__ import annotations

import hmac
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Literal

import redis
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field
from rq import Queue

from . import __version__
from .config import get_settings
from .logging import configure_logging, log

configure_logging()
settings = get_settings()
STARTED_AT = time.time()

COUNTERS: dict[str, int] = {
    "enqueued_total": 0,
    "enqueue_rejected_total": 0,
    "auth_rejected_total": 0,
}

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
    log.info(
        "processor_started",
        extra={"fields": {"version": __version__, "queue": settings.queue_name, "environment": settings.environment}},
    )
    yield
    try:
        app.state.redis.close()
    except Exception:  # noqa: BLE001
        pass


app = FastAPI(
    title="ParsePilot Processing Service",
    version=__version__,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


class EnqueueRequest(BaseModel):
    jobId: str = Field(min_length=1, max_length=80)
    type: Literal["document_process", "export_generate", "retention_sweep"]
    correlationId: str = Field(min_length=1, max_length=80)
    attempt: int = Field(default=1, ge=0, le=100)


def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    expected = settings.internal_token
    if not expected:
        raise HTTPException(status_code=503, detail="Internal service token is not configured")
    if not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        COUNTERS["auth_rejected_total"] += 1
        raise HTTPException(status_code=401, detail="Invalid internal token")


@app.get("/health")
def health() -> dict[str, Any]:
    """Liveness: the process is running. No dependencies are checked."""
    return {"status": "ok", "service": "parsepilot-processor", "version": __version__, "uptimeSeconds": int(time.time() - STARTED_AT)}


@app.get("/ready")
def ready(request: Request, response: Response) -> dict[str, Any]:
    checks: dict[str, Any] = {"tokenConfigured": bool(settings.internal_token)}
    try:
        request.app.state.redis.ping()
        checks["redis"] = "ok"
    except Exception as error:  # noqa: BLE001
        checks["redis"] = type(error).__name__
    ready_now = checks["redis"] == "ok" and checks["tokenConfigured"]
    if not ready_now:
        response.status_code = 503
    return {"status": "ok" if ready_now else "unavailable", "checks": checks, "version": __version__}


@app.get("/metrics")
def metrics() -> Response:
    lines = [
        "# HELP parsepilot_processor_jobs_total Jobs accepted for enqueueing.",
        "# TYPE parsepilot_processor_jobs_total counter",
    ]
    for name, value in COUNTERS.items():
        lines.append(f"parsepilot_processor_{name} {value}")
    lines.append("# TYPE parsepilot_processor_uptime_seconds gauge")
    lines.append(f"parsepilot_processor_uptime_seconds {int(time.time() - STARTED_AT)}")
    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


@app.post("/internal/jobs", dependencies=[Depends(require_internal_token)])
def enqueue_job(body: EnqueueRequest, request: Request) -> dict[str, Any]:
    try:
        request.app.state.redis.ping()
        queue = Queue(settings.queue_name, connection=request.app.state.redis)
        timeout = settings.export_timeout_seconds if body.type == "export_generate" else settings.job_timeout_seconds
        rq_job = queue.enqueue(
            "app.tasks.execute_job",
            body.jobId,
            job_timeout=timeout,
            job_id=f"{body.jobId}-a{body.attempt}",
            description=f"{body.type}:{body.jobId}",
            meta={"correlationId": body.correlationId, "type": body.type},
            retry=None,
        )
        COUNTERS["enqueued_total"] += 1
        log.info("job_enqueued", extra={"fields": {"jobId": body.jobId, "type": body.type, "rqJobId": rq_job.id}})
        return {"data": {"enqueued": True, "jobId": body.jobId, "queueJobId": rq_job.id, "queue": settings.queue_name}}
    except redis.RedisError as error:
        COUNTERS["enqueue_rejected_total"] += 1
        log.error("enqueue_unavailable", extra={"fields": {"jobId": body.jobId, "error": type(error).__name__}})
        raise HTTPException(status_code=503, detail="Queue is unavailable") from error
