"""Typed client for the web service's internal API.

The web service owns all persistent state. This client never receives database
credentials, and every call is authenticated with the shared internal token.
"""

from __future__ import annotations

from typing import Any

import httpx

from .config import get_settings


class WebServiceError(RuntimeError):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class StorageTransferError(RuntimeError):
    """A signed upload/download failed, with safe diagnostics for the UI."""

    def __init__(
        self,
        operation: str,
        message: str,
        *,
        status_code: int | None = None,
        category: str = "transient",
    ) -> None:
        super().__init__(message)
        self.operation = operation
        self.message = message
        self.status_code = status_code
        self.category = category


def _response_detail(response: httpx.Response) -> str:
    """Returns a short provider message without logging the whole body."""
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if isinstance(payload, dict):
        for key in ("message", "error", "error_description"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()[:240]
            if isinstance(value, dict):
                nested = value.get("message") or value.get("code")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()[:240]
    return (response.text or "").strip()[:240]


def _transfer_category(status_code: int) -> str:
    if status_code == 429:
        return "transient"
    if 400 <= status_code < 500:
        return "permanent"
    return "transient"


class WebClient:
    def __init__(self, base_url: str | None = None, token: str | None = None, timeout: float = 30.0) -> None:
        settings = get_settings()
        self._client = httpx.Client(
            base_url=base_url or settings.web_base_url,
            timeout=httpx.Timeout(timeout, connect=10.0),
            headers={
                "x-internal-token": token if token is not None else settings.internal_token,
                "accept": "application/json",
                "user-agent": "parsepilot-processor/1.0",
            },
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "WebClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _request(self, method: str, path: str, *, correlation_id: str | None = None, **kwargs: Any) -> Any:
        headers = kwargs.pop("headers", {})
        if correlation_id:
            headers["x-request-id"] = correlation_id
        response = self._client.request(method, path, headers=headers, **kwargs)
        if response.status_code >= 400:
            code = "internal_request_failed"
            message = response.text[:400]
            try:
                body = response.json()
                error = body.get("error") or {}
                code = error.get("code") or code
                message = error.get("message") or message
            except ValueError:
                pass
            raise WebServiceError(response.status_code, code, message)
        if response.status_code == 204 or not response.content:
            return None
        return response.json().get("data")

    # --- jobs -------------------------------------------------------------
    def next_job(self) -> str | None:
        data = self._request("GET", "/api/v1/internal/jobs/next")
        job_id = (data or {}).get("jobId")
        return str(job_id) if job_id else None

    def claim_job(self, job_id: str, worker_id: str, correlation_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/internal/jobs/{job_id}/claim",
            correlation_id=correlation_id,
            json={"workerId": worker_id},
        )

    def job_context(self, job_id: str, correlation_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/v1/internal/jobs/{job_id}/context",
            correlation_id=correlation_id,
        )

    def record_stage(self, job_id: str, worker_id: str, stage: str, correlation_id: str) -> None:
        self._request(
            "POST",
            f"/api/v1/internal/jobs/{job_id}/stage",
            correlation_id=correlation_id,
            json={"workerId": worker_id, "stage": stage},
        )

    def complete_document(self, job_id: str, worker_id: str, result: dict[str, Any], correlation_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/internal/jobs/{job_id}/result",
            correlation_id=correlation_id,
            json={"workerId": worker_id, "result": result},
        )

    def fail_job(self, job_id: str, worker_id: str, code: str, message: str, category: str, correlation_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/internal/jobs/{job_id}/failure",
            correlation_id=correlation_id,
            json={"workerId": worker_id, "code": code, "message": message, "category": category},
        )

    # --- exports ----------------------------------------------------------
    def export_rows(self, export_id: str, correlation_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/api/v1/internal/exports/{export_id}/rows",
            correlation_id=correlation_id,
        )

    def export_upload_target(self, export_id: str, content_type: str, correlation_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/internal/exports/{export_id}/upload-target",
            correlation_id=correlation_id,
            json={"contentType": content_type},
        )

    def complete_export(self, export_id: str, worker_id: str, payload: dict[str, Any], correlation_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/internal/exports/{export_id}/complete",
            correlation_id=correlation_id,
            json={"workerId": worker_id, **payload},
        )

    # --- maintenance ------------------------------------------------------
    def reconcile_jobs(self, correlation_id: str) -> dict[str, Any]:
        return self._request("POST", "/api/v1/internal/jobs/reconcile", correlation_id=correlation_id)

    def schedule_retention(self, correlation_id: str) -> dict[str, Any]:
        return self._request("POST", "/api/v1/internal/retention/run", correlation_id=correlation_id)

    def execute_retention(self, job_id: str, worker_id: str, correlation_id: str) -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/internal/retention/execute/{job_id}",
            correlation_id=correlation_id,
            json={"workerId": worker_id},
        )

    def download(self, url: str) -> bytes:
        """Fetches a signed or internal URL. Storage redirects are followed."""
        try:
            with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0), follow_redirects=True) as client:
                response = client.get(url)
        except httpx.TimeoutException as error:
            raise StorageTransferError(
                "download",
                "The stored document could not be downloaded before the timeout.",
                category="timeout",
            ) from error
        except httpx.HTTPError as error:
            raise StorageTransferError(
                "download",
                "The stored document could not be downloaded.",
            ) from error
        if response.status_code >= 400:
            detail = _response_detail(response)
            raise StorageTransferError(
                "download",
                f"The stored document could not be downloaded (storage returned {response.status_code}"
                f"{f': {detail}' if detail else ''}).",
                status_code=response.status_code,
                category=_transfer_category(response.status_code),
            )
        return response.content

    def upload(self, url: str, content: bytes, headers: dict[str, str]) -> None:
        try:
            with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0), follow_redirects=True) as client:
                response = client.put(url, content=content, headers=headers)
        except httpx.TimeoutException as error:
            raise StorageTransferError(
                "upload",
                "The export could not be uploaded to storage before the timeout.",
                category="timeout",
            ) from error
        except httpx.HTTPError as error:
            raise StorageTransferError(
                "upload",
                "The export could not be uploaded to storage.",
            ) from error
        if response.status_code >= 400:
            detail = _response_detail(response)
            raise StorageTransferError(
                "upload",
                f"The export could not be uploaded to storage (storage returned {response.status_code}"
                f"{f': {detail}' if detail else ''}).",
                status_code=response.status_code,
                category=_transfer_category(response.status_code),
            )
