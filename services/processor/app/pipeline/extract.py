"""Field extraction.

When an OpenAI-compatible endpoint is configured, the model reads the whole
page first and its readings are the values recorded for the document: the model
sees the layout, which is what label matching cannot do on unusual documents.
The deterministic rules then fill only the keys the model left empty, and the
arithmetic validator still checks totals, so a bad model reading is flagged for
review instead of being exported quietly. A provider that cannot be reached
falls back to the rules and reports the provider error.

The rules deliberately look for labels and blocks rather than taking the first
line that contains a number. That distinction matters on real invoices: a line
item can contain the word "Total", the bill-to block can look like a company
header, and an ambiguous numeric date cannot be resolved without document
context.
"""

from __future__ import annotations

import json
import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from urllib.parse import urlparse

from ..config import AiConfig, get_settings
from .fields import (
    FIELD_TYPES,
    build_fields,
    normalize_currency,
    normalize_date,
    normalize_decimal,
    normalize_field,
)

log = logging.getLogger(__name__)

KIND_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("credit_note", re.compile(r"\bcredit note\b|\bcredit memo\b|\bgutschrift\b|\bavoir\b|\bnota de cr[eé]dito\b", re.I)),
    ("bank_statement", re.compile(r"\bbank statement\b|\bstatement period\b|\bkontoauszug\b|\brelev[eé] de compte\b|\bestado de cuenta\b", re.I)),
    ("receipt", re.compile(r"\breceipt\b|\bcashier\b|\bchange due\b|\bquittung\b|\bre[cç]u\b|\brecibo\b", re.I)),
    # An invoice that mentions a purchase order is still an invoice, so invoice
    # classification wins over the weaker purchase-order signal.
    ("invoice", re.compile(r"\binvoice\b|\btax invoice\b|\bbill to\b|\brechnung\b|\bfacture\b|\bfactura\b", re.I)),
    ("purchase_order", re.compile(r"\bpurchase order\b|\bPO (?:number|no\.?|#)\b|\bbestellung\b|\bbon de commande\b|\borden de compra\b", re.I)),
    ("contract", re.compile(r"\bagreement\b|\bcontract\b|\bvertrag\b|\bcontrat\b|\bcontrato\b", re.I)),
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
    german = sum(_word_count(lowered, word) for word in ("rechnung", "betrag", "steuer", "summe", "zahlbar", "rechnungsdatum"))
    french = sum(_word_count(lowered, word) for word in ("facture", "montant", "tva", "échéance", "fournisseur"))
    spanish = sum(_word_count(lowered, word) for word in ("factura", "importe", "iva", "vencimiento", "proveedor"))
    scores = {"de": german, "fr": french, "es": spanish}
    best = max(scores, key=scores.get)
    if scores[best] >= 2:
        return best
    return "en" if re.search(r"\b(invoice|total|amount|date|due)\b", lowered) else None


# ---------------------------------------------------------------------------
# Text and label helpers
# ---------------------------------------------------------------------------

_DATE_NUMERIC = r"(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})"
_DATE_NAMED = r"(?:\d{1,2}[\s.-]+[A-Za-z\u00C0-\u024F]{3,12}[\s,.-]+\d{4}|[A-Za-z\u00C0-\u024F]{3,12}[\s.-]+\d{1,2}[\s,.-]+\d{4})"
_DATE_TOKEN = re.compile(rf"(?:{_DATE_NUMERIC}|{_DATE_NAMED})", re.I)

_PARTY_LABEL = re.compile(
    r"^(?:bill\s+to|sold\s+to|ship\s+to|deliver\s+to|customer|client|buyer|from|seller|vendor|"
    r"supplier|sold\s+by|bill\s+from|remit\s+to|rechnungsempfänger|rechnungsempfaenger|kunde|"
    r"lieferant|verkäufer|verkaeufer|rechnungssteller|facturé\s+à|facture\s+à|fournisseur|vendeur|"
    r"facturar\s+a|cliente|comprador|proveedor|vendedor)\b",
    re.I,
)

_GENERIC_PARTY = re.compile(
    r"^(?:tax\s+)?(?:invoice|receipt|purchase\s+order|credit\s+note|bill|statement|quotation|estimate|"
    r"document|rechnung|quittung|facture|factura|beleg|avoir|nota\s+de\s+cr[eé]dito)"
    r"(?:\s+(?:no\.?|number|nr\.?|n[°º]?|#|date|datum|nummer))?$",
    re.I,
)

_ADDRESS_HINT = re.compile(
    r"\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|"
    r"suite|floor|unit|building|box|postal|zip|strasse|straße|str\.?|weg|platz|rue|"
    r"calle|avenida|piso|oficina)\b",
    re.I,
)

_CUSTOMER_STOP = re.compile(
    r"^(?:bill\s+to|sold\s+to|ship\s+to|deliver\s+to|customer|client|buyer|rechnungsempfänger|"
    r"rechnungsempfaenger|kunde|facturé\s+à|facture\s+à|facturar\s+a|cliente|comprador)\b",
    re.I,
)

_STOP_LABEL = re.compile(
    r"^(?:invoice|tax\s+invoice|rechnung|quittung|facture|factura|credit\s+note|gutschrift|avoir|"
    r"nota\s+de\s+cr[eé]dito|purchase\s+order|bestellung|bon\s+de\s+commande|orden\s+de\s+compra|"
    r"date|datum|invoice\s+date|issue\s+date|rechnungsdatum|facture\s+date|fecha|due|payment\s+due|"
    r"fälligkeitsdatum|fällig\s+am|échéance|vencimiento|currency|währung|moneda|devise|subtotal|"
    r"sub-total|zwischensumme|sous-total|tax|vat|gst|mwst|ust|tva|iva|total|gesamt|montant|importe|"
    r"payment|terms|iban|page|phone|fax|email|www|invoice\s+no|rechnung\s+nr|"
    r"facture\s+n|factura\s+n|vat\s+id|tax\s+id|tax\s+number)\b",
    re.I,
)

# Labels that identify administrative data, not a party. This is intentionally
# narrower than _STOP_LABEL: a company called "Total Systems" is still a name.
_ADMIN_PREFIX = re.compile(
    r"^(?:all\s+amounts|amounts?|currency|curr\.?|währung|waehrung|moneda|devise|iban|bic|swift|"
    r"payment\s+terms|terms|invoice\s+(?:no\.?|number|date|total)|rechnung\s+(?:nr\.?|nummer|datum)|"
    r"facture\s+(?:n[°º]?|date)|factura\s+(?:n[°º]?|fecha)|due\s+date|fälligkeitsdatum|fällig\s+am|"
    r"échéance|vencimiento|grand\s+total|total\s+amount|amount\s+due|balance\s+due|amount\s+payable|"
    r"total\s+payable|subtotal|sub-total|zwischensumme|sous-total|purchase\s+order|bestellnummer|"
    r"bon\s+de\s+commande|orden\s+de\s+compra|po(?![A-Za-z])|vat\s+id|tax\s+id|tax\s+number|"
    r"ust[-\s]?id(?:nr\.?)?|mwst[-\s]?id|umsatzsteuer[-\s]?id)\b",
    re.I,
)


def _is_admin_line(value: str | None) -> bool:
    if not value:
        return False
    if _ADMIN_PREFIX.match(value):
        return True
    if _STOP_LABEL.match(value) and (re.search(r"[:=]", value) or re.search(r"\d", value)):
        return True
    return False


def _normalize_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _lines(text: str) -> list[str]:
    return [_normalize_line(line) for line in text.splitlines() if line.strip()]


def _clean_party(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip(" \t:.-|,;")
    return cleaned[:120] or None


def _looks_like_address(value: str) -> bool:
    if _ADDRESS_HINT.search(value):
        return True
    if re.search(r"\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b", value):
        return True
    if re.search(r"\b\d{4,6}\b", value) and len(value.split()) <= 8:
        return True
    if re.match(r"^\d+\s+[A-Za-z]", value):
        return True
    return False


def _is_generic_party(value: str | None) -> bool:
    """Rejects headings, labels and address fragments that are not names."""
    if not value:
        return True
    candidate = value.strip()
    normalized = re.sub(r"[^a-z0-9]+", " ", candidate.lower()).strip()
    if not normalized or _GENERIC_PARTY.fullmatch(normalized):
        return True
    if _PARTY_LABEL.match(candidate):
        return True
    if _is_admin_line(candidate):
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
    return len(candidate) > 120


def _best_vendor_from_lines(text: str) -> str | None:
    """Scores the first few lines instead of blindly taking the first one.

    A label such as ``From`` is never a company name. The scan stops when it
    reaches the customer block, so a bill-to company cannot become the vendor.
    """
    lines = _lines(text)
    best: str | None = None
    best_score = 0

    for index, line in enumerate(lines[:20]):
        if _CUSTOMER_STOP.match(line):
            break
        candidate = _clean_party(line)
        if not candidate or _is_generic_party(candidate):
            continue
        if len(candidate.split()) > 8:
            continue
        if re.search(r"\b\d{3,}\b", candidate):
            continue

        score = 0
        if re.search(
            r"\b(?:ltd|limited|llc|inc|incorporated|corp|corporation|co|company|gmbh|plc|llp|pty|"
            r"sarl|s\.a\.|b\.v\.|n\.v\.|ag|oy|ab|spa|srl)\b\.?",
            candidate,
            re.I,
        ):
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


def _find_party_block(lines: list[str], patterns: list[re.Pattern[str]]) -> list[str]:
    """Returns the inline value plus the lines directly below a party label.

    Labels are searched in priority order, not merely document order, so a
    ``Bill To`` block wins over an earlier ``Ship To`` block.
    """
    for pattern in patterns:
        for index, line in enumerate(lines):
            match = pattern.match(line)
            if not match:
                continue
            inline = _clean_party(match.group(1)) if match.groups() else None
            block: list[str] = [inline] if inline else []
            cursor = index + 1
            while cursor < len(lines) and len(block) < 6:
                candidate = lines[cursor]
                if _STOP_LABEL.match(candidate):
                    break
                if _PARTY_LABEL.match(candidate):
                    break
                block.append(candidate)
                cursor += 1
            return block
    return []


def _party_details(block: list[str]) -> tuple[str | None, str | None]:
    name: str | None = None
    addresses: list[str] = []

    for raw in block:
        candidate = _clean_party(raw)
        if not candidate:
            continue

        if name is None and "," in candidate and _looks_like_address(candidate):
            head, remainder = candidate.split(",", 1)
            head = _clean_party(head)
            if head and not _is_generic_party(head) and not _looks_like_address(head):
                name = head
                remainder = _clean_party(remainder)
                if remainder:
                    addresses.append(remainder)
                continue

        if name is None and not _is_generic_party(candidate) and not _looks_like_address(candidate):
            name = candidate
            continue

        if _looks_like_address(candidate):
            addresses.append(candidate)

    address = ", ".join(dict.fromkeys(addresses))[:300] if addresses else None
    return name, address


def _find_labeled_text(lines: list[str], patterns: list[re.Pattern[str]]) -> str | None:
    for pattern in patterns:
        for index, line in enumerate(lines):
            match = pattern.match(line)
            if not match:
                continue
            value = (match.group(1) or "").strip(" \t:.-#|,;")
            if value and not _STOP_LABEL.match(value) and not _DATE_TOKEN.fullmatch(value):
                return value[:240]
            if not value and index + 1 < len(lines):
                following = lines[index + 1].strip()
                if following and not _STOP_LABEL.match(following) and not _DATE_TOKEN.fullmatch(following):
                    return following[:240]
    return None


_PARTY_PATTERNS_VENDOR = [
    re.compile(r"^(?:bill\s+from|from)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:seller|vendor|supplier|sold\s+by|remit\s+to)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:lieferant|verkäufer|verkaeufer|rechnungssteller)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:fournisseur|vendeur|proveedor|vendedor)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
]

_PARTY_PATTERNS_CUSTOMER = [
    re.compile(r"^(?:bill\s+to|sold\s+to)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:customer|client|buyer)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:rechnungsempfänger|rechnungsempfaenger|kunde)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:facturé\s+à|facture\s+à|client)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:facturar\s+a|cliente|comprador)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:ship\s+to|deliver\s+to)(?![A-Za-z])\s*[:\-]?\s*(.*)$", re.I),
]

_VENDOR_ADDRESS_LABELS = [
    re.compile(r"^(?:vendor|seller|supplier|from)\s+address\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:lieferanschrift|adresse\s+du\s+fournisseur|direcci[oó]n\s+del\s+proveedor)\s*[:\-]?\s*(.*)$", re.I),
]

_CUSTOMER_ADDRESS_LABELS = [
    re.compile(r"^(?:customer|billing|bill\s+to)\s+address\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:rechnungsadresse|adresse\s+de\s+facturation|direcci[oó]n\s+de\s+facturaci[oó]n)\s*[:\-]?\s*(.*)$", re.I),
]


def _currency(text: str, lines: list[str]) -> str | None:
    label_patterns = [
        re.compile(r"^(?:currency|curr\.?|währung|waehrung|moneda|devise)\s*[:\-]?\s*(.*)$", re.I),
    ]
    labeled = _find_labeled_text(lines, label_patterns)
    normalized = normalize_currency(labeled) if labeled else None
    if normalized:
        return normalized

    # A three-letter code in a company name is not evidence of a currency. Only
    # accept a code next to a monetary signal, or on a line by itself.
    code_pattern = r"(?:USD|EUR|GBP|JPY|INR|CHF|CAD|AUD|NZD|SEK|NOK|DKK|PLN|CZK|HUF|RON|BRL|MXN|ZAR|SGD|HKD|CNY|AED|ILS)"
    codes: set[str] = set()
    for line in lines:
        found = {match.group(0).upper() for match in re.finditer(code_pattern, line, re.I)}
        if not found:
            continue
        if (
            line.strip().upper() in found
            or re.search(r"\b(?:currency|amounts?|all\s+amounts|total|subtotal|tax|balance|due|invoice|payment)\b", line, re.I)
            or re.search(rf"(?:[$€£¥₹]|\b{code_pattern}\b\s*\d|\d[\d.,]*\s*\b{code_pattern}\b)", line, re.I)
        ):
            codes.update(found)
    if len(codes) == 1:
        return next(iter(codes))
    symbol = re.search(r"([$€£¥₹])", text)
    if symbol:
        return normalize_currency(symbol.group(1))
    return None


def _infer_date_order(text: str, currency: str | None) -> str:
    """Infers MDY versus DMY from unambiguous dates, currency and language.

    An ambiguous date on its own is not enough evidence. The previous default
    was day-first for every document, which silently swapped US invoice dates.
    """
    signals: set[str] = set()
    for match in re.finditer(r"(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?!\d)", text):
        first, second = int(match.group(1)), int(match.group(2))
        if first > 12 >= second:
            signals.add("dmy")
        elif second > 12 >= first:
            signals.add("mdy")

    if signals == {"mdy"}:
        return "mdy"
    if signals == {"dmy"}:
        return "dmy"
    if currency == "USD":
        return "mdy"
    if currency in {"EUR", "GBP", "CHF"}:
        return "dmy"
    if re.search(r"\b(?:rechnung|rechnungsdatum|facture|factura|betrag|montant|importe)\b", text, re.I):
        return "dmy"
    return "dmy"


def _date_from_labels(lines: list[str], patterns: list[re.Pattern[str]], exclude: re.Pattern[str] | None = None) -> str | None:
    for pattern in patterns:
        for index, line in enumerate(lines):
            if exclude and exclude.search(line):
                continue
            match = pattern.match(line)
            if not match:
                continue
            remainder = match.group(1) if match.groups() else ""
            found = _DATE_TOKEN.search(remainder)
            if found:
                return found.group(0)
            if index + 1 < len(lines):
                found = _DATE_TOKEN.search(lines[index + 1])
                if found:
                    return found.group(0)
    return None


_ISSUE_DATE_LABELS = [
    re.compile(r"^(?:invoice\s+date|issue\s+date|date\s+of\s+issue|issued(?:\s+on)?)\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:rechnungsdatum|facture\s+date|date\s+de\s+facture|fecha\s+de\s+factura)\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:date|datum|fecha)\s*[:\-]?\s*(.*)$", re.I),
]

_DUE_DATE_LABELS = [
    re.compile(r"^(?:due\s+date|payment\s+due|due)\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:fälligkeitsdatum|fällig\s+am|faelligkeitsdatum|faellig\s+am)\s*[:\-]?\s*(.*)$", re.I),
    re.compile(r"^(?:échéance|date\s+d['’]échéance|vencimiento|fecha\s+de\s+vencimiento)\s*[:\-]?\s*(.*)$", re.I),
]

_DUE_WORD = re.compile(r"\b(?:due|fällig|faellig|échéance|vencimiento)\b", re.I)

# ---------------------------------------------------------------------------
# Document number and identifiers
# ---------------------------------------------------------------------------

_DOCUMENT_NUMBER_LABELS = [
    re.compile(
        r"^(?:invoice|tax\s+invoice|document|receipt|credit\s+note|debit\s+note|rechnung|beleg|facture|"
        r"factura|nota\s+de\s+cr[eé]dito)\s*(?:number|no\.?|nr\.?|n[°º]?|#|nummer|num[eé]ro|n[uú]mero)"
        r"(?![A-Za-z])\s*[:#.-]?\s*(.*)$",
        re.I,
    ),
    re.compile(
        r"^(?:rechnungsnummer|rechnungs-nr\.?|n[°º]?\s*de\s+facture|num[eé]ro\s+de\s+facture|"
        r"n[uú]mero\s+de\s+factura)\s*[:#.-]?\s*(.*)$",
        re.I,
    ),
    re.compile(r"^(?:number|no\.?|nr\.?|#)(?![A-Za-z])\s*[:#.-]?\s*(.*)$", re.I),
]

_TAX_ID_LABELS = [
    re.compile(r"^(?:vat|tax)\s*(?:id|no\.?|number|nummer|num[eé]ro|n[uú]mero)\s*[:#.-]?\s*(.*)$", re.I),
    re.compile(
        r"^(?:ust[-\s]?id(?:nr\.?)?|mwst[-\s]?id|umsatzsteuer[-\s]?id|num[eé]ro\s+de\s+tva|nif|cif)"
        r"\s*[:#.-]?\s*(.*)$",
        re.I,
    ),
]

_PO_LABELS = [
    re.compile(
        r"^(?:purchase\s+order|po(?![A-Za-z])|bestellnummer|bon\s+de\s+commande|orden\s+de\s+compra)"
        r"(?:\s*(?:number|no\.?|nr\.?|#))?\s*[:#.-]?\s*(.*)$",
        re.I,
    ),
]

_PAYMENT_TERMS_LABEL = re.compile(
    r"^(?:payment\s+terms|terms|zahlungsbedingungen|conditions\s+de\s+paiement|condiciones\s+de\s+pago)"
    r"\s*[:\-]?\s*(.*)$",
    re.I,
)

# A payment-term value has to say when payment is due. This prevents generic
# prose after "Payment Terms:" from being stored as a term.
_PAYMENT_TERM_SIGNAL = re.compile(
    r"\b(?:net|due|within|days?|weeks?|months?|immediate(?:ly)?|upon|receipt|advance|cash|cod|"
    r"eom|end\s+of\s+month|payable|sofort|netto|comptant|fällig|vencimiento|contado|zahlbar|"
    r"zahlungsziel|anzahlung|vorauszahlung)\b|\d",
    re.I,
)


def _payment_terms_from_lines(lines: list[str]) -> str | None:
    for index, line in enumerate(lines):
        match = _PAYMENT_TERMS_LABEL.match(line)
        if not match:
            continue
        candidates = []
        inline = (match.group(1) or "").strip(" \t:.-|,;")
        if inline:
            candidates.append(inline)
        if index + 1 < len(lines):
            candidates.append(lines[index + 1].strip())
        for candidate in candidates:
            if _is_admin_line(candidate) or not _PAYMENT_TERM_SIGNAL.search(candidate):
                continue
            return candidate[:120]
    return None

_AMOUNT_PAID_LABEL = re.compile(
    r"^(?:amount\s+paid|paid|payment\s+received|received|bezahlt|montant\s+pay[eé]|importe\s+pagado)"
    r"\s*[:\-]?\s*(.*)$",
    re.I,
)

# ---------------------------------------------------------------------------
# Amounts
# ---------------------------------------------------------------------------

_NUMBER_TOKEN = re.compile(
    r"(?<![\w])(?:\(\s*)?(?:[$€£¥₹]\s*)?[-−]?\d[\d.,]*(?:\s+\d{3})*\)?(?![\w%])"
)

_SUBTOTAL_LABEL = re.compile(
    r"^(?:subtotal|sub-total|sub\s+total|net\s+amount|net\s+total|zwischensumme|sous-total|"
    r"importe\s+neto|base\s+imponible|total\s+before\s+tax|goods\s+total)\b",
    re.I,
)

_TAX_LABEL = re.compile(
    r"^(?:sales\s+tax|tax\s+amount|total\s+tax|tax|vat|gst|mwst|ust|umsatzsteuer|mehrwertsteuer|"
    r"tva|iva|taxe|impuesto)\b",
    re.I,
)

_TOTAL_LABEL_HIGH = re.compile(
    r"^(?:grand\s+total|total\s+due|amount\s+due|balance\s+due|invoice\s+total|total\s+amount|"
    r"amount\s+payable|total\s+payable|payable|zahlbetrag|rechnungsbetrag|gesamtbetrag|gesamt|"
    r"montant\s+total|total\s+ttc|net\s+[àa]\s+payer|importe\s+total|total\s+a\s+pagar)\b",
    re.I,
)

_TOTAL_LABEL = re.compile(r"^total\b", re.I)

_TOTAL_EXCLUDE = re.compile(
    r"\b(?:tax|vat|gst|mwst|ust|tva|iva|quantity|qty|items?|pages?|discount|deposit|shipping|freight)\b",
    re.I,
)

_TAX_EXCLUDE = re.compile(
    r"\b(?:tax\s+id|tax\s+no|tax\s+number|taxable|tax\s+code|vat\s+id|vat\s+no|vat\s+number|"
    r"ust[-\s]?id(?:nr\.?)?|mwst[-\s]?id|umsatzsteuer[-\s]?id|id\s*nr\.?)\b",
    re.I,
)

_AMOUNT_EXCLUDE = re.compile(r"\b(?:quantity|qty|items?|pages?|percent|rate)\b", re.I)


def _amount_candidates(line: str) -> list[str]:
    """Extracts normalised monetary values from a labelled line.

    Percentages are removed first so ``VAT 19% 190.00`` yields 190.00 rather
    than 19.00. Spaces inside European thousands are collapsed before parsing.
    """
    work = re.sub(r"\d+(?:[.,]\d+)?\s*%", "", line)
    work = re.sub(r"(?<=\d)\s+(?=\d{3}(?:\D|$))", "", work)
    values: list[str] = []
    for match in _NUMBER_TOKEN.finditer(work):
        token = match.group(0).strip()
        if re.fullmatch(r"\d{4}[-/.]\d{1,2}[-/.]\d{1,2}", token):
            continue
        normalized = normalize_decimal(token)
        if normalized is not None:
            values.append(normalized)
    return values


def _line_amount(line: str, label: re.Pattern[str]) -> str | None:
    if not label.match(line):
        return None
    if _AMOUNT_EXCLUDE.search(line) and not re.search(r"[$€£¥₹]\s?\d", line):
        return None
    values = _amount_candidates(line)
    return values[-1] if values else None


def _subtotal_from_lines(lines: list[str]) -> str | None:
    for line in reversed(lines):
        value = _line_amount(line, _SUBTOTAL_LABEL)
        if value:
            return value
    return None


def _tax_from_lines(lines: list[str]) -> str | None:
    for line in reversed(lines):
        if not _TAX_LABEL.match(line):
            continue
        if _TAX_EXCLUDE.search(line) or re.search(r"\b(?:id|no\.?|number|nummer)\b", line, re.I):
            continue
        values = _amount_candidates(line)
        if values:
            return values[-1]
    return None


def _total_from_lines(lines: list[str]) -> str | None:
    candidates: list[tuple[int, int, str]] = []
    for index, line in enumerate(lines):
        high = _TOTAL_LABEL_HIGH.match(line)
        generic = _TOTAL_LABEL.match(line)
        if not high and not generic:
            continue
        if generic and not high and _TOTAL_EXCLUDE.search(line):
            # "Total (tax included)" is the final amount, not a tax subtotal.
            if not re.search(
                r"\b(?:tax|vat|gst|mwst|tva|iva)\s+(?:is\s+)?included\b|\b(?:incl\.?|including)\s+(?:tax|vat|gst|mwst|tva|iva)\b",
                line,
                re.I,
            ):
                continue
        if re.search(r"\b(?:quantity|qty|items?|pages?)\b", line, re.I):
            continue
        values = _amount_candidates(line)
        if values:
            candidates.append((0 if high else 1, index, values[-1]))
    if not candidates:
        return None
    best_priority = min(candidate[0] for candidate in candidates)
    best = max(
        (candidate for candidate in candidates if candidate[0] == best_priority),
        key=lambda candidate: candidate[1],
    )
    return best[2]


def _amount_paid_from_lines(lines: list[str]) -> str | None:
    for line in reversed(lines):
        if not _AMOUNT_PAID_LABEL.match(line):
            continue
        if re.search(r"\b(?:paid\s+by|payment\s+method|paid\s+on)\b", line, re.I):
            continue
        values = _amount_candidates(line)
        if values:
            return values[-1]
    return None


# ---------------------------------------------------------------------------
# IBAN and line items
# ---------------------------------------------------------------------------

def _valid_iban(candidate: str) -> bool:
    compact = re.sub(r"[^A-Za-z0-9]", "", candidate).upper()
    if not (15 <= len(compact) <= 34):
        return False
    rearranged = compact[4:] + compact[:4]
    try:
        numeric = "".join(str(int(character, 36)) if character.isalpha() else character for character in rearranged)
        return int(numeric) % 97 == 1
    except ValueError:
        return False


def _find_iban(text: str) -> str | None:
    for match in re.finditer(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b", text, re.I):
        candidate = match.group(0).upper()
        if _valid_iban(candidate):
            return candidate
    return None


_LINE_ITEM_EXCLUDE = re.compile(
    r"^(?:subtotal|sub-total|sub\s+total|tax|vat|gst|mwst|ust|tva|iva|total|amount\s+due|balance|"
    r"payment|discount|iban|vat\s+id|tax\s+id|page)\b",
    re.I,
)


def extract_line_items(text: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for raw_line in text.splitlines():
        line = _normalize_line(raw_line)
        if not line or "|" in line or _LINE_ITEM_EXCLUDE.match(line):
            continue
        # A trailing ISO code is not the amount column.
        line = re.sub(r"\s+[A-Z]{3}$", "", line)
        match = re.match(
            r"^(?P<description>[A-Za-z][^\n]{0,90}?)\s+"
            r"(?P<quantity>\d{1,4}(?:[.,]\d+)?)\s+"
            r"(?:(?:x|×|@)\s+)?"
            r"(?P<unit>\S+)\s+"
            r"(?P<amount>\S+)\s*$",
            line,
        )
        if not match:
            continue
        description = match.group("description").strip(" \t:.-|,;")
        if len(description.split()) > 12 or re.search(r"\b(?:total|subtotal|tax|vat|gst|amount)\b", description, re.I):
            continue
        quantity = normalize_decimal(match.group("quantity"))
        unit_price = normalize_decimal(match.group("unit"))
        amount = normalize_decimal(match.group("amount"))
        if not quantity or not unit_price or not amount:
            continue
        try:
            quantity_decimal = Decimal(quantity)
            unit_decimal = Decimal(unit_price)
            amount_decimal = Decimal(amount)
        except InvalidOperation:
            continue
        if quantity_decimal <= 0:
            continue
        tolerance = max(Decimal("0.02"), abs(amount_decimal) * Decimal("0.01"))
        if abs(quantity_decimal * unit_decimal - amount_decimal) > tolerance:
            continue
        items.append(
            {
                "description": description,
                "quantity": quantity,
                "unit_price": unit_price,
                "amount": amount,
            }
        )
        if len(items) >= 50:
            break
    return items


# ---------------------------------------------------------------------------
# Public extraction
# ---------------------------------------------------------------------------

def _document_title(lines: list[str]) -> str | None:
    title_pattern = re.compile(
        r"^(?:tax\s+invoice|invoice|receipt|credit\s+note|purchase\s+order|rechnung|quittung|"
        r"facture|factura|beleg|avoir|nota\s+de\s+cr[eé]dito)$",
        re.I,
    )
    for line in lines[:8]:
        if title_pattern.fullmatch(line.strip(" :.-")):
            return line.strip(" :.-")[:120]
    return None


def extract_rules(text: str) -> dict[str, Any]:
    lines = _lines(text)
    currency = _currency(text, lines)
    date_order = _infer_date_order(text, currency)

    issue_raw = _date_from_labels(lines, _ISSUE_DATE_LABELS, exclude=_DUE_WORD)
    due_raw = _date_from_labels(lines, _DUE_DATE_LABELS)

    vendor_block = _find_party_block(lines, _PARTY_PATTERNS_VENDOR)
    vendor, vendor_address = _party_details(vendor_block)
    if not vendor:
        vendor = _best_vendor_from_lines(text)
    if not vendor_address:
        vendor_address = _find_labeled_text(lines, _VENDOR_ADDRESS_LABELS)

    customer_block = _find_party_block(lines, _PARTY_PATTERNS_CUSTOMER)
    customer, customer_address = _party_details(customer_block)
    if not customer_address:
        customer_address = _find_labeled_text(lines, _CUSTOMER_ADDRESS_LABELS)

    document_number = _find_labeled_text(lines, _DOCUMENT_NUMBER_LABELS)
    tax_id = _find_labeled_text(lines, _TAX_ID_LABELS)
    po = _find_labeled_text(lines, _PO_LABELS)
    if po and re.match(r"^box\b", po, re.I):
        po = None
    payment_terms = _payment_terms_from_lines(lines)

    raw: dict[str, Any] = {
        "document_title": _document_title(lines),
        "document_number": document_number,
        "vendor_name": vendor,
        "vendor_address": vendor_address,
        "vendor_tax_id": tax_id,
        "customer_name": customer,
        "customer_address": customer_address,
        "issue_date": normalize_date(issue_raw, date_order) if issue_raw else None,
        "due_date": normalize_date(due_raw, date_order) if due_raw else None,
        "currency": currency,
        "subtotal": _subtotal_from_lines(lines),
        "tax_amount": _tax_from_lines(lines),
        "total_amount": _total_from_lines(lines),
        "amount_paid": _amount_paid_from_lines(lines),
        "payment_terms": payment_terms,
        "purchase_order": po,
        "iban": _find_iban(text),
        "line_items": None,
    }

    items = extract_line_items(text)
    if items:
        raw["line_items"] = json.dumps(items, ensure_ascii=False)

    return {key: value for key, value in raw.items() if value not in (None, "")}


def _confidence_for(key: str, rules: dict[str, Any]) -> float:
    if rule := rules.get(key):
        if key in {"total_amount", "subtotal", "tax_amount", "issue_date", "currency"}:
            return 0.9
        if key in {"vendor_name", "document_number", "customer_name"}:
            return 0.78
        return 0.7
    return 0.4


_AI_CONFIDENCE = 0.92

# The model keeps a disagreement too, but the lower score tells the reviewer the
# rules read that field differently. It stays above the validator's 0.6
# low-confidence threshold because the model's reading is the value we want.
_AI_DISAGREEMENT_CONFIDENCE = 0.8


def _is_reasoning_model(model: str) -> bool:
    """Reasoning models reject `temperature` on the chat-completions API."""
    return bool(re.match(r"^(?:o\d|gpt-5)", model, re.I))


def _comparable(key: str, value: Any) -> str:
    normalized = normalize_field(key, str(value)) if key in FIELD_TYPES else None
    return re.sub(r"\s+", " ", normalized or str(value)).strip().casefold()


def _same_value(key: str, left: Any, right: Any) -> bool:
    if left is None or right is None:
        return left is None and right is None
    return _comparable(key, left) == _comparable(key, right)


def _ai_value_usable(key: str, value: Any) -> bool:
    """Rejects a model value that cannot be the field it claims to be.

    The model is authoritative on what the document says, not on data types or
    on what a party name is: an address block or a heading returned as
    vendor_name would otherwise overwrite a correct rule reading.
    """
    text = str(value).strip()
    if not text:
        return False
    field_type = FIELD_TYPES.get(key)
    if field_type == "date":
        return normalize_date(text) is not None
    if field_type == "decimal":
        return normalize_decimal(text) is not None
    if field_type == "currency":
        return normalize_currency(text) is not None
    if key == "line_items":
        try:
            items = json.loads(text) if isinstance(value, str) else value
        except ValueError:
            return False
        return isinstance(items, list) and bool(items)
    if key in {"vendor_name", "customer_name"}:
        return not _is_generic_party(text) and not _looks_like_address(text)
    return len(text) <= 300


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
        "line_items": {
            "type": ["string", "null"],
            "description": "JSON array of objects with description, quantity, unit_price and amount",
        },
    },
    "required": list(FIELD_TYPES.keys()),
}


_GOOGLE_AI_HOST = "generativelanguage.googleapis.com"


def provider_chat_url(base_url: str) -> str:
    """OpenAI-compatible chat-completions URL for a provider base URL.

    Gemini exposes its OpenAI-compatible surface only under /v1beta/openai, so
    the native base URL a user copies from the docs (…/v1) answered 404 for
    every document while the extraction quietly fell back to the rules.
    """
    base = base_url.strip().rstrip("/")
    host = (urlparse(base).hostname or "").lower()
    if host == _GOOGLE_AI_HOST or host.endswith(f".{_GOOGLE_AI_HOST}"):
        return f"https://{_GOOGLE_AI_HOST}/v1beta/openai/chat/completions"
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def _provider_error_note(response: httpx.Response) -> str:
    """Short, non-secret provider message so a failure is visible in the UI."""
    detail = ""
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            detail = str(error.get("message") or error.get("status") or "")
        elif isinstance(error, str):
            detail = error
        if not detail:
            detail = str(payload.get("message") or "")
    detail = re.sub(r"\s+", " ", detail).strip()[:160]
    return f"ai_provider_error:{response.status_code}{f' {detail}' if detail else ''}"


def ai_extract(
    text: str, ai: AiConfig | None = None
) -> tuple[dict[str, Any] | None, str | None, str | None]:
    """Returns (fields, model, error). error is a safe note for the result."""
    settings = get_settings()
    if not settings.ai_enabled:
        return None, None, None
    config = ai or AiConfig(
        api_key=settings.ai_api_key or "",
        base_url=settings.ai_base_url,
        model=settings.ai_model,
    )
    api_key = config.api_key.strip()
    # Providers accept the bare model id; “models/…” is the Gemini native form.
    model_name = re.sub(r"^models/", "", config.model.strip())
    if not api_key or not model_name:
        return None, None, None

    payload: dict[str, Any] = {
        "model": model_name,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Extract accounting fields from the document text. Use null when a value is absent. "
                    "Never invent values. vendor_name is the seller or issuer, never the bill-to customer or "
                    "the document heading. customer_name is the buyer. document_title is only the heading. "
                    "Ignore line-item totals when choosing total_amount; choose the final amount due. "
                    "Dates must be ISO 8601 and amounts decimal strings. line_items must be a JSON array of "
                    "objects with description, quantity, unit_price and amount. Return only the JSON object."
                ),
            },
            {"role": "user", "content": text[:60_000]},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "document_fields", "strict": True, "schema": AI_SCHEMA},
        },
    }
    if not _is_reasoning_model(config.model):
        payload["temperature"] = 0
    url = provider_chat_url(config.base_url)
    headers = {"authorization": f"Bearer {api_key}", "content-type": "application/json"}
    if url.startswith(f"https://{_GOOGLE_AI_HOST}"):
        # Google accepts the bearer token; the native header also keeps plain
        # gateways in front of it working.
        headers["x-goog-api-key"] = api_key
    try:
        with httpx.Client(timeout=httpx.Timeout(settings.ai_timeout_seconds, connect=10.0)) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code in {400, 404, 405, 415, 422} and "response_format" in payload:
                # Some reasoning models expose JSON output only through their
                # newer API surface. Retry with a plain JSON instruction rather
                # than silently falling back to rules for every document.
                fallback = dict(payload)
                fallback.pop("response_format", None)
                fallback.pop("temperature", None)
                fallback["messages"] = [
                    {**payload["messages"][0], "content": payload["messages"][0]["content"] + " Return a single JSON object only."},
                    payload["messages"][1],
                ]
                response = client.post(url, headers=headers, json=fallback)
            if response.status_code >= 400:
                log.warning("ai_extraction_failed", extra={"fields": {"status": response.status_code}})
                return None, None, _provider_error_note(response)
            body = response.json()
        content = str(body["choices"][0]["message"]["content"] or "").strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.I).strip()
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            return None, None, "ai_provider_error:invalid_json"
        model = str(body.get("model") or model_name)[:120]
        return parsed, model, None
    except Exception as error:  # noqa: BLE001 - provider failures must not fail the job
        # Log only the error class, never the provider response body or the key.
        log.warning("ai_extraction_failed", extra={"fields": {"error": type(error).__name__}})
        return None, None, f"ai_provider_error:{type(error).__name__}"


def extract(
    text: str, ai: AiConfig | None = None
) -> tuple[list[dict[str, Any]], str, str | None, list[str], str | None]:
    """Returns (fields, kind, language, warnings, model)."""
    warnings: list[str] = []
    rules = extract_rules(text)
    ai_fields, model, ai_error = ai_extract(text, ai)

    if ai_fields is not None:
        # What the model read on the page is what the document says. The rules
        # fill the keys it left empty; where both read a key differently, the
        # model's reading is kept and the disagreement is recorded for review.
        merged: dict[str, Any] = {
            key: {"value": value, "confidence": _confidence_for(key, rules)}
            for key, value in rules.items()
            if key in FIELD_TYPES
        }
        for key, value in ai_fields.items():
            if key not in FIELD_TYPES or value in (None, ""):
                continue
            if not _ai_value_usable(key, value):
                continue
            rule_value = rules.get(key)
            if rule_value not in (None, "") and not _same_value(key, rule_value, value):
                merged[key] = {"value": value, "confidence": _AI_DISAGREEMENT_CONFIDENCE}
                warnings.append(f"provider_disagreement:{key}")
            else:
                merged[key] = {"value": value, "confidence": _AI_CONFIDENCE}
    else:
        merged = dict(rules)

    if ai_error:
        warnings.append("ai_extraction_failed")
        warnings.append(ai_error)

    fields = build_fields(merged)
    if ai_fields is None:
        for field in fields:
            if field.get("confidence") is None:
                field["confidence"] = _confidence_for(field["key"], rules)
    kind = classify(text)
    language = detect_language(text)
    if not fields:
        warnings.append("no_fields_extracted")
    return fields, kind, language, warnings, model
