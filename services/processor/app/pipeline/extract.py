"""Field extraction.

Rules run first and are always available. When an OpenAI-compatible endpoint is
configured, a schema-constrained model call can fill gaps; any provider failure
falls back to the deterministic result and is reported as a warning.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from ..config import get_settings
from .fields import FIELD_TYPES, build_fields, normalize_currency, normalize_date, normalize_decimal

log = logging.getLogger(__name__)

KIND_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("credit_note", re.compile(r"\bcredit note\b|\bcredit memo\b", re.I)),
    ("bank_statement", re.compile(r"\bbank statement\b|\bstatement period\b", re.I)),
    ("receipt", re.compile(r"\breceipt\b|\bcashier\b|\bchange due\b", re.I)),
    # An invoice that mentions a purchase order is still an invoice, so invoice
    # classification wins over the weaker purchase-order signal.
    ("invoice", re.compile(r"\binvoice\b|\btax invoice\b|\bbill to\b", re.I)),
    ("purchase_order", re.compile(r"\bpurchase order\b|\bPO (?:number|no\.?|#)\b", re.I)),
    ("contract", re.compile(r"\bagreement\b|\bcontract\b", re.I)),
]


def classify(text: str) -> str:
    for kind, pattern in KIND_PATTERNS:
        if pattern.search(text):
            return kind
    return "unknown"


def _word_count(text: str, word: str) -> int:
    return len(re.findall(rf"\b{re.escape(word)}\b", text))


def detect_language(text: str) -> str | None:
    # Deliberately lightweight: the pipeline does not ship language models.
    lowered = text.lower()
    german = sum(_word_count(lowered, word) for word in ("rechnung", "betrag", "steuer", "summe", "zahlbar"))
    french = sum(_word_count(lowered, word) for word in ("facture", "montant", "tva", "total", "échéance"))
    spanish = sum(_word_count(lowered, word) for word in ("factura", "importe", "iva", "vencimiento"))
    scores = {"de": german, "fr": french, "es": spanish}
    best = max(scores, key=scores.get)
    if scores[best] >= 2:
        return best
    return "en" if re.search(r"\b(invoice|total|amount|date|due)\b", lowered) else None


def _first_match(text: str, patterns: list[str], flags: int = re.I) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            value = next((group for group in match.groups() if group), None)
            if value:
                return value.strip(" \t:.-")
    return None


def _money(pattern: str, text: str) -> str | None:
    raw = _first_match(text, [pattern])
    if not raw:
        return None
    return normalize_decimal(raw)


_GENERIC_PARTY = re.compile(
    r"^(?:tax\s+)?(?:invoice|receipt|purchase\s+order|credit\s+note|bill|statement|quotation|estimate|document)"
    r"(?:\s+(?:no\.?|number|#|date))?$",
    re.I,
)
_ADDRESS_HINT = re.compile(
    r"\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|suite|floor|unit|building|box|postal|zip)"
    r"\b",
    re.I,
)
_PARTY_LABEL = re.compile(
    r"^(?:bill\s+to|ship\s+to|customer|client|sold\s+to|invoice\s+(?:date|number|no|#)|receipt\s+(?:date|number|no|#)|"
    r"date|due\s+date|total|subtotal|tax|amount|terms|po\b|purchase\s+order|iban|vat|customer\s+id|page|phone|email|www)\b",
    re.I,
)
_COMPANY_SUFFIX = re.compile(
    r"\b(?:ltd|limited|llc|inc|incorporated|corp|corporation|co|company|gmbh|plc|llp|pty|sarl|s\.a\.|b\.v\.|n\.v\.|ag|oy|ab|spa|srl)\b\.?",
    re.I,
)


def _clean_party(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip(" \t:.-|,;")
    return cleaned[:90] or None


def _is_generic_party(value: str | None) -> bool:
    """Rejects page headings and labels that are not party names."""
    if not value:
        return True
    candidate = value.strip()
    normalized = re.sub(r"[^a-z0-9]+", " ", candidate.lower()).strip()
    if not normalized or _GENERIC_PARTY.fullmatch(normalized):
        return True
    if _PARTY_LABEL.match(candidate):
        return True
    if _ADDRESS_HINT.search(candidate):
        return True
    if re.fullmatch(r"[\d\s.,$€£¥₹%()+-]+", candidate):
        return True
    if "@" in candidate or "http" in candidate.lower():
        return True
    if re.search(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b", candidate):
        return True
    if re.search(r"\b(?:page|of)\s+\d+\b", candidate, re.I):
        return True
    return len(candidate) > 90


def _best_vendor_from_lines(text: str) -> str | None:
    """Scores the first few lines instead of blindly taking the first one.

    Templates often put a generic word such as INVOICE on the first line. A
    company-like line near the top is a much better vendor candidate; rejecting
    headings and addresses also prevents confidently wrong values from being
    written into the review queue.
    """
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    best: str | None = None
    best_score = 0

    for index, line in enumerate(lines[:20]):
        if re.match(r"^(?:bill\s+to|ship\s+to|customer|client|sold\s+to)\b", line, re.I):
            break
        candidate = _clean_party(line)
        if not candidate or _is_generic_party(candidate):
            continue
        if len(candidate.split()) > 8:
            continue
        # Long digit sequences are usually phone/address/date fragments, not names.
        if re.search(r"\b\d{3,}\b", candidate):
            continue

        score = 0
        if _COMPANY_SUFFIX.search(candidate):
            score += 4
        words = candidate.split()
        if 1 <= len(words) <= 6 and not re.search(r"\d", candidate):
            score += 2
        if index <= 4:
            score += 2
        if candidate.istitle() or candidate.isupper():
            score += 1

        if score > best_score:
            best = candidate
            best_score = score

    return best if best_score >= 3 else None


def extract_rules(text: str) -> dict[str, Any]:
    currency_raw = _first_match(text, [r"\b(?:currency|curr\.?)\s*[:\-]?\s*([A-Za-z]{3})\b"])
    if not currency_raw:
        symbol_match = re.search(r"([$€£¥₹])\s?\d", text)
        currency_raw = symbol_match.group(1) if symbol_match else None

    issue_raw = _first_match(
        text,
        [
            r"(?:invoice|issue|issued|document|receipt)\s*(?:date)?\s*[:\-]?\s*([0-9]{4}-[0-9]{1,2}-[0-9]{1,2}|[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4})",
            r"\bdate\s*[:\-]?\s*([0-9]{4}-[0-9]{1,2}-[0-9]{1,2}|[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4})",
        ],
    )
    due_raw = _first_match(
        text,
        [r"due\s*(?:date)?\s*[:\-]?\s*([0-9]{4}-[0-9]{1,2}-[0-9]{1,2}|[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4})"],
    )
    if not issue_raw:
        any_date = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
        issue_raw = any_date.group(1) if any_date else None

    vendor = _first_match(
        text,
        [
            r"(?:from|seller|vendor|supplier|bill\s+from)\s*[:\-]\s*([^\n]{2,90})",
        ],
    )
    vendor = _clean_party(vendor)
    if _is_generic_party(vendor):
        vendor = _best_vendor_from_lines(text)

    customer = _first_match(text, [r"(?:bill to|customer|client|buyer)\s*[:\-]\s*([^\n]{2,90})"])
    document_number = _first_match(
        text,
        [
            r"(?:invoice|document|receipt|credit note)\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/_.]{1,40})",
            r"\b(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/_.]{2,40})",
        ],
    )
    po = _first_match(text, [r"(?:purchase order|PO)\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/_.]{1,40})"])
    iban = _first_match(text, [r"\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b"], flags=0)
    terms = _first_match(text, [r"(?:payment terms|terms)\s*[:\-]\s*([^\n]{2,60})"])
    title = _first_match(text, [r"^\s*([A-Z][A-Z /&-]{5,60})\s*$"], flags=re.M)
    tax_id = _first_match(text, [r"(?:vat|tax)\s*(?:id|no\.?|number)\s*[:\-]?\s*([A-Z0-9\- ]{4,30})"])
    address = _first_match(text, [r"(?:address)\s*[:\-]\s*([^\n]{5,120})"])
    amount_paid = _money(r"(?:amount paid|paid|balance paid)\s*[:\-]?\s*([$€£¥₹]?\s?[\d.,]+)", text)

    subtotal = _money(r"(?:subtotal|sub-total|net amount)\s*[:\-]?\s*([$€£¥₹]?\s?[\d.,]+)", text)
    tax = _money(
        r"(?:sales\s+tax|tax|vat|gst)\b\s*(?:amount)?\s*(?:\([^)]*\))?\s*(?:\d+(?:\.\d+)?\s*%)?\s*[:\-]?\s*([$€£¥₹]?\s?[\d.,]+)",
        text,
    )
    total = _money(r"\b(?:grand total|total due|amount due|total)\b\s*[:\-]?\s*([$€£¥₹]?\s?[\d.,]+)", text)

    line_items = extract_line_items(text)

    raw: dict[str, Any] = {
        "document_title": title,
        "document_number": document_number,
        "vendor_name": vendor,
        "vendor_address": address,
        "vendor_tax_id": tax_id,
        "customer_name": customer,
        "issue_date": normalize_date(issue_raw),
        "due_date": normalize_date(due_raw),
        "currency": normalize_currency(currency_raw),
        "subtotal": subtotal,
        "tax_amount": tax,
        "total_amount": total,
        "amount_paid": amount_paid,
        "payment_terms": terms,
        "purchase_order": po,
        "iban": iban,
        "line_items": json.dumps(line_items, ensure_ascii=False) if line_items else None,
    }
    return {key: value for key, value in raw.items() if value not in (None, "")}


def extract_line_items(text: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    pattern = re.compile(
        r"^(?P<description>[A-Za-z][^\n]{3,80}?)\s{2,}(?P<quantity>\d{1,4})\s+(?P<unit>[$€£¥₹]?\s?[\d.,]+)\s+(?P<amount>[$€£¥₹]?\s?[\d.,]+)\s*$",
        re.M,
    )
    for match in pattern.finditer(text):
        items.append(
            {
                "description": match.group("description").strip(),
                "quantity": match.group("quantity"),
                "unit_price": normalize_decimal(match.group("unit")) or match.group("unit"),
                "amount": normalize_decimal(match.group("amount")) or match.group("amount"),
            }
        )
        if len(items) >= 50:
            break
    return items


def _confidence_for(key: str, rules: dict[str, Any]) -> float:
    if rule := rules.get(key):
        if key in {"total_amount", "subtotal", "tax_amount", "issue_date", "currency"}:
            return 0.86
        if key in {"vendor_name", "document_number"}:
            return 0.72
        return 0.65
    return 0.4


AI_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "document_title": {"type": ["string", "null"]},
        "document_number": {"type": ["string", "null"]},
        "vendor_name": {"type": ["string", "null"]},
        "vendor_address": {"type": ["string", "null"]},
        "vendor_tax_id": {"type": ["string", "null"]},
        "customer_name": {"type": ["string", "null"]},
        "customer_address": {"type": ["string", "null"]},
        "issue_date": {"type": ["string", "null"], "description": "ISO 8601 date (YYYY-MM-DD)"},
        "due_date": {"type": ["string", "null"], "description": "ISO 8601 date (YYYY-MM-DD)"},
        "currency": {"type": ["string", "null"], "description": "ISO 4217 code"},
        "subtotal": {"type": ["string", "null"], "description": "Decimal string with two places"},
        "tax_amount": {"type": ["string", "null"], "description": "Decimal string with two places"},
        "total_amount": {"type": ["string", "null"], "description": "Decimal string with two places"},
        "amount_paid": {"type": ["string", "null"]},
        "payment_terms": {"type": ["string", "null"]},
        "purchase_order": {"type": ["string", "null"]},
        "iban": {"type": ["string", "null"]},
        "line_items": {"type": ["string", "null"], "description": "JSON array of line items"},
    },
    "required": list(FIELD_TYPES.keys()),
}


def ai_extract(text: str) -> tuple[dict[str, Any] | None, str | None]:
    settings = get_settings()
    if not settings.ai_enabled or not settings.ai_api_key:
        return None, None

    payload = {
        "model": settings.ai_model,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Extract accounting fields from the document text. Use null when a value is absent. "
                    "Never invent values. Dates must be ISO 8601 and amounts decimal strings. "
                    "Return only the JSON object."
                ),
            },
            {"role": "user", "content": text[:60_000]},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "document_fields", "strict": True, "schema": AI_SCHEMA},
        },
    }
    try:
        with httpx.Client(timeout=httpx.Timeout(settings.ai_timeout_seconds, connect=10.0)) as client:
            response = client.post(
                f"{settings.ai_base_url}/chat/completions",
                headers={"authorization": f"Bearer {settings.ai_api_key}", "content-type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
        content = body["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            return None, "ai_invalid_response"
        model = str(body.get("model") or settings.ai_model)[:120]
        return parsed, model
    except Exception as error:  # noqa: BLE001 - provider failures must not fail the job
        # Log only the error class, never the provider response body or the key.
        log.warning("ai_extraction_failed", extra={"fields": {"error": type(error).__name__}})
        return None, "ai_extraction_failed"


def extract(text: str) -> tuple[list[dict[str, Any]], str, str | None, list[str], str | None]:
    """Returns (fields, kind, language, warnings, model)."""
    warnings: list[str] = []
    rules = extract_rules(text)
    merged: dict[str, Any] = dict(rules)

    ai_fields, model = ai_extract(text)
    if ai_fields:
        for key, value in ai_fields.items():
            if key not in FIELD_TYPES or value in (None, ""):
                continue
            if not merged.get(key):
                merged[key] = {"value": value, "confidence": 0.9}
            elif value != merged[key]:
                warnings.append(f"provider_disagreement:{key}")
    elif model == "ai_extraction_failed":
        warnings.append("ai_extraction_failed")

    fields = build_fields(merged)
    if not ai_fields:
        for field in fields:
            if field.get("confidence") is None:
                field["confidence"] = _confidence_for(field["key"], rules)
    kind = classify(text)
    language = detect_language(text)
    if not fields:
        warnings.append("no_fields_extracted")
    return fields, kind, language, warnings, model
