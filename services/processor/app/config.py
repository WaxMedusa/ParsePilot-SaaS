"""Configuration for the processing service.

All values come from the environment so the same image runs in development,
CI and production. Secrets have no insecure fallback: internal endpoints reject
every request until INTERNAL_SERVICE_TOKEN is set.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _int_env(name: str, fallback: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return fallback
    try:
        value = int(raw)
    except ValueError:
        return fallback
    return value if value > 0 else fallback


def _float_env(name: str, fallback: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return fallback
    try:
        value = float(raw)
    except ValueError:
        return fallback
    return value if value > 0 else fallback


def _bool_env(name: str, fallback: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return fallback
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    internal_token: str
    web_base_url: str
    redis_url: str
    queue_name: str
    worker_id: str
    environment: str
    processor_version: str

    ai_api_key: str | None
    ai_base_url: str
    ai_model: str
    ai_timeout_seconds: float
    ai_enabled: bool

    ocr_enabled: bool
    ocr_max_pages: int
    max_pages: int
    max_download_mb: int
    job_timeout_seconds: int
    export_timeout_seconds: int
    scheduler_interval_seconds: int
    reconcile_interval_seconds: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    hostname = os.getenv("HOSTNAME", "processor")
    return Settings(
        internal_token=os.getenv("INTERNAL_SERVICE_TOKEN", ""),
        web_base_url=os.getenv("WEB_INTERNAL_URL", "http://127.0.0.1:3000").rstrip("/"),
        redis_url=os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"),
        queue_name=os.getenv("PROCESSING_QUEUE", os.getenv("QUEUE_NAME", "parsepilot")),
        worker_id=os.getenv("WORKER_ID", f"{hostname}-{os.getpid()}"),
        environment=os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development")),
        processor_version=os.getenv("PROCESSOR_VERSION", "1.0.0"),
        ai_api_key=os.getenv("OPENAI_API_KEY") or os.getenv("AI_API_KEY") or None,
        ai_base_url=os.getenv("PROCESSOR_AI_BASE_URL", os.getenv("AI_BASE_URL", "https://api.openai.com/v1")).rstrip("/"),
        ai_model=os.getenv("PROCESSOR_AI_MODEL", os.getenv("AI_MODEL", "gpt-4.1-mini")),
        ai_timeout_seconds=_float_env("PROCESSOR_AI_TIMEOUT_SECONDS", 45.0),
        ai_enabled=_bool_env("PROCESSOR_AI_ENABLED", True),
        ocr_enabled=_bool_env("PROCESSOR_OCR_ENABLED", _bool_env("OCR_ENABLED", True)),
        ocr_max_pages=_int_env("PROCESSOR_OCR_MAX_PAGES", 40),
        max_pages=_int_env("PROCESSOR_MAX_PAGES", 200),
        max_download_mb=_int_env("PROCESSOR_MAX_DOWNLOAD_MB", 50),
        job_timeout_seconds=_int_env("PROCESSOR_JOB_TIMEOUT_SECONDS", 900),
        export_timeout_seconds=_int_env("PROCESSOR_EXPORT_TIMEOUT_SECONDS", 300),
        scheduler_interval_seconds=_int_env("PROCESSOR_SCHEDULER_INTERVAL_SECONDS", 3600),
        reconcile_interval_seconds=_int_env("PROCESSOR_RECONCILE_INTERVAL_SECONDS", 300),
    )
