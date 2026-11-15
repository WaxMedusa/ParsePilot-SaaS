"""Job execution.

RQ is only a delivery mechanism. The authoritative state machine lives in
PostgreSQL and is driven through the web service's internal API, so a worker
crash, duplicate delivery or Redis flush cannot lose or double-charge a job.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

import httpx

from .config import get_settings
from .logging import configure_logging, log
from .pipeline.export import build_export
from .pipeline.extract import extract
from .pipeline.text import PipelineError, extract_text
from .pipeline.validate import validate
from .web_client import WebClient, WebServiceError

log = logging.getLogger(__name__)

VALID_STAGES = {
    "extracting_text",
    "running_ocr",
    "extracting_fields",
    "validating",
    "detecting_duplicates",
}


def _failure_from(error: BaseException) -> tuple[str, str, str]:
    if isinstance(error, PipelineError):
        return error.code, error.message[:1000], error.category
    if isinstance(error, WebServiceError):
        category = "transient" if error.status_code >= 500 or error.status_code == 429 else "permanent"
        return f"web_{error.code}"[:80], error.message[:1000], category
    if isinstance(error, httpx.TimeoutException):
        return "download_timeout", "The document could not be downloaded before the timeout.", "timeout"
    if isinstance(error, httpx.HTTPError):
        return "download_failed", "The stored document could not be downloaded.", "transient"
    return "processing_failed", (str(error) or "The worker failed unexpectedly.")[:1000], "transient"


def process_document(client: WebClient, job_id: str, context: dict[str, Any], correlation_id: str) -> None:
    settings = get_settings()
    worker_id = settings.worker_id
    document = context.get("document")
    if not document:
        raise PipelineError("document_missing", "The job has no document attached.")

    started = time.monotonic()

    def stage(name: str) -> None:
        if name in VALID_STAGES:
            client.record_stage(job_id, worker_id, name, correlation_id)

    log.info("job_stage", extra={"fields": {"jobId": job_id, "stage": "extracting_text"}})
    stage("extracting_text")
    data = client.download(document["downloadUrl"])
    if len(data) > settings.max_download_mb * 1024 * 1024:
        raise PipelineError("file_too_large", "The stored document exceeds the worker download limit.")

    extracted = extract_text(
        data,
        document.get("mimeType") or "application/octet-stream",
        on_ocr=lambda: stage("running_ocr"),
    )

    stage("extracting_fields")
    text = extracted.text
    if not text:
        raise PipelineError(
            "no_text_extracted",
            "No readable text could be extracted. The scan may be blank or too low quality for OCR.",
        )

    fields, kind, language, warnings, model = extract(text)

    stage("validating")
    validation_warnings, requires_review = validate(fields)
    warnings.extend(validation_warnings)

    stage("detecting_duplicates")
    # Duplicate detection is completed by the web service: it checks the
    # content checksum (authoritative) and any candidate supplied here.

    if requires_review and "requires_review" not in warnings:
        warnings.append("requires_review")

    unique_warnings = list(dict.fromkeys(warnings))[:20]
    result = {
        "pagesProcessed": max(1, extracted.page_count),
        "ocrUsed": extracted.ocr_used,
        "kind": kind if kind in {
            "invoice",
            "receipt",
            "purchase_order",
            "credit_note",
            "bank_statement",
            "contract",
            "other",
            "unknown",
        } else "unknown",
        "language": language,
        "provider": "openai-compatible" if model else "rules",
        "model": model,
        "durationMs": int((time.monotonic() - started) * 1000),
        "fields": fields,
        "duplicateCandidate": None,
        "warnings": [warning[:300] for warning in unique_warnings],
    }
    client.complete_document(job_id, worker_id, result, correlation_id)
    log.info(
        "document_processed",
        extra={
            "fields": {
                "jobId": job_id,
                "documentId": document.get("id"),
                "pages": extracted.page_count,
                "ocrUsed": extracted.ocr_used,
                "kind": kind,
                "durationMs": result["durationMs"],
                "warnings": len(unique_warnings),
            }
        },
    )


def generate_export(client: WebClient, job_id: str, context: dict[str, Any], correlation_id: str) -> None:
    settings = get_settings()
    export = context.get("export")
    if not export:
        raise PipelineError("export_missing", "The job has no export attached.")

    dataset = client.export_rows(export["id"], correlation_id)
    columns = list(dataset.get("columns") or [])
    rows = list(dataset.get("rows") or [])
    if not columns:
        raise PipelineError("export_empty", "There are no columns to export.")

    content, content_type = build_export(dataset.get("format") or export.get("format") or "csv", columns, rows)
    target = client.export_upload_target(export["id"], content_type, correlation_id)
    client.upload(target["uploadUrl"], content, target.get("headers", {}).get("Content-Type", content_type))
    client.complete_export(
        export["id"],
        settings.worker_id,
        {"storageKey": target["storageKey"], "sizeBytes": len(content), "rowCount": len(rows)},
        correlation_id,
    )
    log.info(
        "export_generated",
        extra={"fields": {"jobId": job_id, "exportId": export["id"], "rows": len(rows), "bytes": len(content)}},
    )


def execute_job(job_id: str) -> None:
    """RQ entrypoint. Never raises for job-level failures: the web service owns retries."""
    configure_logging()
    settings = get_settings()
    correlation_id = str(uuid.uuid4())
    client = WebClient()
    try:
        # Context is readable before claiming so the retention job can use its
        # dedicated executor, which performs its own atomic claim. Claiming it
        # twice would make the sweep unreachable.
        context = client.job_context(job_id, correlation_id)
        job = context.get("job") or {}
        job_type = job.get("type")
        correlation_id = job.get("correlationId") or correlation_id

        if job_type == "retention_sweep":
            log.info("retention_started", extra={"fields": {"jobId": job_id}})
            result = client.execute_retention(job_id, settings.worker_id, correlation_id)
            log.info("retention_completed", extra={"fields": {"jobId": job_id, "result": result}})
            return

        claimed = client.claim_job(job_id, settings.worker_id, correlation_id)
        if not claimed or not claimed.get("claimed"):
            log.info("job_not_claimable", extra={"fields": {"jobId": job_id}})
            return

        log.info("job_started", extra={"fields": {"jobId": job_id, "type": job_type, "attempt": job.get("attempts")}})
        if job_type == "document_process":
            process_document(client, job_id, context, correlation_id)
        elif job_type == "export_generate":
            generate_export(client, job_id, context, correlation_id)
        else:
            raise PipelineError("unknown_job_type", f"Unsupported job type: {job_type}")
    except Exception as error:  # noqa: BLE001 - classify and report every failure
        code, message, category = _failure_from(error)
        log.error(
            "job_failed",
            extra={"fields": {"jobId": job_id, "code": code, "category": category, "error": type(error).__name__}},
            exc_info=True,
        )
        try:
            client.fail_job(job_id, settings.worker_id, code, message, category, correlation_id)
        except Exception:  # noqa: BLE001 - the reconciler will retry from the DB state
            log.error("job_failure_report_failed", extra={"fields": {"jobId": job_id}}, exc_info=True)
    finally:
        client.close()
