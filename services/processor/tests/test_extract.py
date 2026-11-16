from app.pipeline.extract import classify, extract, extract_line_items, extract_rules

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


def test_line_items_are_extracted():
    text = "Widget A            2    10.00    20.00\nService fee         1    75.50    75.50"
    items = extract_line_items(text)
    assert len(items) == 2
    assert items[0]["description"] == "Widget A"
    assert items[0]["amount"] == "20.00"
    assert items[1]["unit_price"] == "75.50"
