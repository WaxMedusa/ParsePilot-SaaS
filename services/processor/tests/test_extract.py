from app.config import AiConfig, ai_config_from_context
from app.pipeline.extract import ai_extract, classify, extract, extract_line_items, extract_rules
from app.pipeline.validate import validate

INVOICE_TEXT = """
ACME SUPPLY LTD
Invoice Number: INV-2026-0042
Invoice Date: 2026-03-14
Due Date: 2026-04-13
Bill To: Northwind Finance
Currency: USD
Subtotal: 1,000.00
Tax (20%): 234.50
Total: 1,234.50
Payment Terms: Net 30
Purchase Order: PO-9911
IBAN: GB33BUKB20201555555555
"""


def test_classify_invoice_and_receipt():
    assert classify(INVOICE_TEXT) == "invoice"
    assert classify("Thank you — receipt\nChange due 0.00") == "receipt"
    assert classify("A document with no signals") == "unknown"


def test_extract_rules_invoice_fields():
    fields = extract_rules(INVOICE_TEXT)
    assert fields["vendor_name"] == "ACME SUPPLY LTD"
    assert fields["document_number"] == "INV-2026-0042"
    assert fields["issue_date"] == "2026-03-14"
    assert fields["due_date"] == "2026-04-13"
    assert fields["currency"] == "USD"
    assert fields["subtotal"] == "1000.00"
    assert fields["tax_amount"] == "234.50"
    assert fields["total_amount"] == "1234.50"
    assert fields["payment_terms"].startswith("Net 30")
    assert fields["iban"].startswith("GB33")


def test_vendor_heading_is_not_treated_as_vendor_name():
    text = """INVOICE
East Repair Inc.
1912 Harvest Lane
Invoice # us-001
Invoice Date: 2026-11-16
Currency: USD
Subtotal: 145.00
Sales Tax 6.25% 9.06
Total: 154.06
"""
    fields = extract_rules(text)
    assert fields["vendor_name"] == "East Repair Inc"
    assert fields["vendor_name"] != "INVOICE"
    assert fields["tax_amount"] == "9.06"
    assert fields["subtotal"] == "145.00"
    assert fields["total_amount"] == "154.06"


def test_generic_heading_without_a_company_is_not_used_as_vendor():
    fields = extract_rules("INVOICE\nBill To: Northwind\nTotal: 10.00\n")
    assert "vendor_name" not in fields


def test_extract_returns_payload_without_ai(monkeypatch):
    monkeypatch.setenv("PROCESSOR_AI_ENABLED", "false")
    from app.config import get_settings

    get_settings.cache_clear()
    fields, kind, language, warnings, model = extract(INVOICE_TEXT)
    by_key = {field["key"]: field for field in fields}
    assert kind == "invoice"
    assert language == "en"
    assert model is None
    assert by_key["total_amount"]["value"] == "1234.50"
    assert 0 < by_key["total_amount"]["confidence"] <= 1
    assert all(warning != "ai_extraction_failed" for warning in warnings)


def test_ai_disagreement_keeps_the_rule_value_and_requires_review(monkeypatch):
    def fake_ai(_text: str, _ai=None):
        return (
            {
                "vendor_name": "Acme Supply Limited",
                "document_number": "INV-2026-0042",
                "vendor_address": "1 Example Road, London",
                "total_amount": "9999.99",
            },
            "o4-mini",
        )

    monkeypatch.setattr("app.pipeline.extract.ai_extract", fake_ai)

    fields, _kind, _language, warnings, model = extract(INVOICE_TEXT)
    by_key = {field["key"]: field for field in fields}

    assert model == "o4-mini"
    # The model may fill a gap, but it may not replace a value the rules found.
    assert by_key["vendor_name"]["value"] == "ACME SUPPLY LTD"
    assert by_key["vendor_name"]["confidence"] < 0.6
    assert by_key["vendor_address"]["value"] == "1 Example Road, London"
    assert by_key["total_amount"]["value"] == "1234.50"
    assert "provider_disagreement:vendor_name" in warnings
    assert "provider_disagreement:total_amount" in warnings
    _validation_warnings, requires_review = validate(fields)
    assert requires_review


def test_ai_cannot_replace_a_party_with_an_address(monkeypatch):
    monkeypatch.setattr(
        "app.pipeline.extract.ai_extract",
        lambda _text, _ai=None: ({"vendor_name": "123 Main Street"}, "gpt-4.1-mini"),
    )

    fields, _kind, _language, warnings, _model = extract(INVOICE_TEXT)
    by_key = {field["key"]: field for field in fields}

    assert by_key["vendor_name"]["value"] == "ACME SUPPLY LTD"
    assert by_key["vendor_name"]["confidence"] < 0.6
    assert "provider_disagreement:vendor_name" in warnings


class _StubResponse:
    status_code = 200

    def raise_for_status(self):
        return None

    def json(self):
        return {"model": "gemini-2.5-flash", "choices": [{"message": {"content": "{}"}}]}


class _StubClient:
    def __init__(self, captured):
        self._captured = captured

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def post(self, url, headers=None, json=None):
        self._captured.append({"url": url, "headers": headers, "json": json})
        return _StubResponse()


def test_ai_extract_uses_the_workspace_provider(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("PROCESSOR_AI_ENABLED", "true")
    get_settings.cache_clear()
    captured: list[dict] = []
    monkeypatch.setattr("app.pipeline.extract.httpx.Client", lambda **_kwargs: _StubClient(captured))
    try:
        parsed, model = ai_extract(
            INVOICE_TEXT,
            AiConfig(api_key="workspace-key", base_url="https://provider.test/v1", model="gemini-2.5-flash"),
        )
    finally:
        get_settings.cache_clear()

    assert parsed == {}
    assert model == "gemini-2.5-flash"
    assert captured[0]["url"] == "https://provider.test/v1/chat/completions"
    assert captured[0]["headers"]["authorization"] == "Bearer workspace-key"
    assert captured[0]["json"]["model"] == "gemini-2.5-flash"


def test_extract_forwards_the_workspace_config(monkeypatch):
    seen: dict = {}

    def fake_ai(_text: str, ai=None):
        seen["ai"] = ai
        return None, None

    monkeypatch.setattr("app.pipeline.extract.ai_extract", fake_ai)
    config = AiConfig(api_key="workspace-key", base_url="https://provider.test/v1", model="gemini-2.5-flash")
    extract(INVOICE_TEXT, config)
    assert seen["ai"] == config


def test_ai_config_from_context_distinguishes_no_override_from_disabled():
    assert ai_config_from_context(None) is None

    disabled = ai_config_from_context({"baseUrl": "https://provider.test/v1", "model": "m", "apiKey": ""})
    assert disabled is not None and disabled.api_key == ""

    config = ai_config_from_context(
        {"apiKey": "workspace-key", "baseUrl": "https://provider.test/v1", "model": "m"}
    )
    assert config == AiConfig(api_key="workspace-key", base_url="https://provider.test/v1", model="m")


def test_empty_workspace_key_disables_ai_even_with_a_deployment_key(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("PROCESSOR_AI_ENABLED", "true")
    monkeypatch.setenv("AI_API_KEY", "deployment-key")
    get_settings.cache_clear()
    try:
        disabled = AiConfig(api_key="", base_url="https://provider.test/v1", model="m")
        assert ai_extract(INVOICE_TEXT, disabled) == (None, None)
    finally:
        get_settings.cache_clear()


def test_line_items_are_extracted():
    text = "Widget A            2    10.00    20.00\nService fee         1    75.50    75.50"
    items = extract_line_items(text)
    assert len(items) == 2
    assert items[0]["description"] == "Widget A"
    assert items[0]["amount"] == "20.00"
    assert items[1]["unit_price"] == "75.50"
