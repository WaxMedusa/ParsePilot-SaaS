"""Field registry and normalisation.

This mirrors apps/web/src/lib/documents/fields.ts. The web service re-normalises
and validates every submitted value, so this module is a first pass that makes
the payload deterministic rather than the security boundary.
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

FIELD_TYPES: dict[str, str] = {
    "document_title": "string",
    "document_number": "string",
    "vendor_name": "string",
    "vendor_address": "string",
    "vendor_tax_id": "string",
    "customer_name": "string",
    "customer_address": "string",
    "issue_date": "date",
    "due_date": "date",
    "currency": "currency",
    "subtotal": "decimal",
    "tax_amount": "decimal",
    "total_amount": "decimal",
    "amount_paid": "decimal",
    "payment_terms": "string",
    "purchase_order": "string",
    "iban": "string",
    "line_items": "json",
}

REQUIRED_FOR_REVIEW = ("vendor_name", "issue_date", "total_amount", "currency")

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

CURRENCY_SYMBOLS = {
    "$": "USD", "US$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR",
    "CHF": "CHF", "R$": "BRL", "A$": "AUD", "C$": "CAD",
}


def iso_date(year: int, month: int, day: int) -> str | None:
    try:
        parsed = date(year, month, day)
    except ValueError:
        return None
    if not (1900 <= parsed.year <= 2200):
        return None
    return parsed.isoformat()


def normalize_date(raw: str | None) -> str | None:
    if not raw:
        return None
    value = raw.strip()
    if not value:
        return None

    match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$", value)
    if match:
        return iso_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))

    match = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})$", value)
    if match:
        return iso_date(int(match.group(1)), int(match.group(2)), int(match.group(3)))

    match = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$", value)
    if match:
        first, second, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if first > 12 >= second:
            return iso_date(year, second, first)
        if second > 12 >= first:
            return iso_date(year, first, second)
        return iso_date(year, second, first)

    match = re.match(r"^(\d{1,2})[\s.-]+([A-Za-z]{3,9})[\s,.-]+(\d{4})$", value)
    if match and match.group(2).lower() in MONTHS:
        return iso_date(int(match.group(3)), MONTHS[match.group(2).lower()], int(match.group(1)))

    match = re.match(r"^([A-Za-z]{3,9})[\s.-]+(\d{1,2})[\s,.-]+(\d{4})$", value)
    if match and match.group(1).lower() in MONTHS:
        return iso_date(int(match.group(3)), MONTHS[match.group(1).lower()], int(match.group(2)))

    return None


def normalize_currency(raw: str | None) -> str | None:
    if not raw:
        return None
    value = raw.strip()
    if not value:
        return None
    if re.fullmatch(r"[A-Za-z]{3}", value):
        code = value.upper()
        return code
    if value in CURRENCY_SYMBOLS:
        return CURRENCY_SYMBOLS[value]
    for token, code in sorted(CURRENCY_SYMBOLS.items(), key=lambda item: len(item[0]), reverse=True):
        if token in value:
            return code
    # Only uppercase three-letter tokens are treated as ISO codes; otherwise
    # arbitrary words such as "Amount" would be misread as "AMO".
    match = re.search(r"\b[A-Z]{3}\b", value)
    return match.group(0) if match else None


def normalize_decimal(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = str(raw).strip()
    if not value:
        return None

    negative = bool(re.match(r"^\(.*\)$", value) or value.startswith("-") or re.search(r"-\s*$", value))
    value = re.sub(r"[()]", "", value)
    value = value.replace("−", "").replace("-", "")
    value = re.sub(r"[^0-9.,]", "", value)
    if not value:
        return None

    last_dot = value.rfind(".")
    last_comma = value.rfind(",")
    if last_dot != -1 and last_comma != -1:
        decimal_separator = "." if last_dot > last_comma else ","
        thousands_separator = "," if decimal_separator == "." else "."
        value = value.replace(thousands_separator, "")
        value = value.replace(decimal_separator, ".")
    elif last_comma != -1:
        if value.count(",") == 1 and len(value.split(",")[1]) in (1, 2):
            value = value.replace(",", ".")
        else:
            value = value.replace(",", "")
    elif last_dot != -1 and value.count(".") > 1:
        value = value.replace(".", "")

    try:
        decimal = Decimal(value)
    except InvalidOperation:
        return None
    if negative:
        decimal = -decimal
    quantized = decimal.quantize(Decimal("0.01"))
    return f"{quantized:.2f}"


def normalize_field(field_key: str, value: str | None) -> str | None:
    field_type = FIELD_TYPES.get(field_key, "string")
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    if field_type == "date":
        return normalize_date(value) or value
    if field_type == "currency":
        return normalize_currency(value) or value
    if field_type == "decimal":
        return normalize_decimal(value) or value
    return value[:8000]


def build_fields(raw: dict[str, Any]) -> list[dict[str, Any]]:
    fields: list[dict[str, Any]] = []
    for key, entry in raw.items():
        if key not in FIELD_TYPES or entry is None:
            continue
        if isinstance(entry, dict) and "value" in entry:
            value = entry.get("value")
            confidence = entry.get("confidence")
        else:
            value = entry
            confidence = None
        if value is None:
            continue
        if key == "line_items" and not isinstance(value, str):
            import json

            value = json.dumps(value, ensure_ascii=False)
        normalized = normalize_field(key, str(value))
        if not normalized:
            continue
        if confidence is not None:
            confidence = max(0.0, min(1.0, float(confidence)))
        fields.append({"key": key, "value": normalized, "confidence": confidence})
    return fields
