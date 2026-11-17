"""Cross-field validation before the result is submitted.

The web service validates again and is authoritative; this pass keeps obviously
inconsistent extractions from being presented as clean completions.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

from .fields import REQUIRED_FOR_REVIEW, normalize_decimal


def _decimal(fields: dict[str, str], key: str) -> Decimal | None:
    raw = fields.get(key)
    normalized = normalize_decimal(raw) if raw else None
    if not normalized:
        return None
    try:
        return Decimal(normalized)
    except InvalidOperation:
        return None


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _line_item_sum(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        items = json.loads(value)
    except (TypeError, ValueError):
        return None
    if not isinstance(items, list):
        return None
    total = Decimal("0")
    seen = False
    for item in items:
        if not isinstance(item, dict):
            continue
        amount = normalize_decimal(str(item.get("amount")))
        if amount is None:
            continue
        try:
            total += Decimal(amount)
            seen = True
        except InvalidOperation:
            continue
    return total if seen else None


def validate(fields: list[dict[str, Any]]) -> tuple[list[str], bool]:
    values = {field["key"]: field.get("value") for field in fields if field.get("value")}
    warnings: list[str] = []

    for key in REQUIRED_FOR_REVIEW:
        if not values.get(key):
            warnings.append(f"missing_required:{key}")

    subtotal = _decimal(values, "subtotal")
    tax = _decimal(values, "tax_amount")
    total = _decimal(values, "total_amount")
    amount_paid = _decimal(values, "amount_paid")

    if subtotal is not None and tax is not None and total is not None:
        if abs((subtotal + tax) - total) > Decimal("0.02"):
            warnings.append("totals_inconsistent")
    if total is not None and total >= 0:
        if subtotal is not None and subtotal > total + Decimal("0.02"):
            warnings.append("subtotal_exceeds_total")
        if tax is not None and tax > total + Decimal("0.02"):
            warnings.append("tax_exceeds_total")

    line_items = _line_item_sum(values.get("line_items"))
    if line_items is not None and subtotal is not None:
        if abs(line_items - subtotal) > Decimal("0.02"):
            warnings.append("line_items_inconsistent")

    if amount_paid is not None and total is not None and amount_paid > total + Decimal("0.02"):
        warnings.append("amount_paid_exceeds_total")

    if total is not None and total < 0:
        warnings.append("negative_total")

    issue = _parse_date(values.get("issue_date"))
    due = _parse_date(values.get("due_date"))
    if issue and due and due < issue:
        warnings.append("due_before_issue")

    if issue and issue.year > date.today().year + 1:
        warnings.append("issue_date_in_future")

    low_confidence = [
        field["key"]
        for field in fields
        if isinstance(field.get("confidence"), (int, float)) and field["confidence"] < 0.6
    ]
    if low_confidence:
        warnings.append("low_confidence_fields")

    requires_review = bool(warnings)
    return warnings, requires_review
