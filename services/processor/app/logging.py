"""Structured JSON logs. Never log document contents, tokens or signed URLs."""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

_SERVICE = "parsepilot-processor"


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "service": _SERVICE,
            "environment": os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development")),
            "message": record.getMessage(),
            "logger": record.name,
        }
        extra = getattr(record, "fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str | None = None) -> None:
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel((level or os.getenv("LOG_LEVEL", "info")).upper())
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def log(event: str, level: int = logging.INFO, **fields: Any) -> None:
    logging.getLogger(_SERVICE).log(level, event, extra={"fields": fields})
