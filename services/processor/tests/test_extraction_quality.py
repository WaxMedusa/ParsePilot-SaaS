from decimal import Decimal

from app.pipeline.extract import classify, extract, extract_line_items, extract_rules
from app.pipeline.fields import normalize_date
from app.pipeline.validate import validate


US_INVOICE = """NORTHSTAR SUPPLY LLC
Invoice No. NS-1042
Invoice Date: 03/04/2026
Due Date: 04/03/2026
Bill To
Contoso Finance
500 Market Street
San Francisco, CA 94105
Currency: USD
Widget A 2 10.00 20.00
Service fee 1 80.00 80.00
Subtotal: 100.00
Sales Tax 8.25%: 8.25
Total: 108.25
"""

GERMAN_INVOICE = """Müller GmbH
Rechnung Nr. DE-2026-77
Rechnungsdatum: 04.03.2026
Fälligkeitsdatum: 03.04.2026
Kunde: Nordwind AG
Währung: EUR
Zwischensumme: 1.000,00
MwSt 19%: 190,00
Gesamtbetrag: 1.190,00
"""

FROM_BILL_TO_INVOICE = """INVOICE
From
Acme Supply
123 Main Street
Bill To
Northwind Finance
500 Market Street
Invoice Date: 2026-03-04
Currency: USD
Total: 100.00
"""


def test_us_invoice_uses_currency_to_resolve_ambiguous_dates():
    fields = extract_rules(US_INVOICE)

    assert fields["document_number"] == "NS-1042"
    assert fields["issue_date"] == "2026-03-04"
    assert fields["due_date"] == "2026-04-03"
    assert fields["vendor_name"] == "NORTHSTAR SUPPLY LLC"
    assert fields["customer_name"] == "Contoso Finance"
    assert fields["customer_address"] == "500 Market Street, San Francisco, CA 94105"
    assert fields["total_amount"] == "108.25"


def test_does_not_turn_party_labels_or_customer_into_vendor():
    fields = extract_rules(FROM_BILL_TO_INVOICE)

    assert fields["vendor_name"] == "Acme Supply"
    assert fields["vendor_address"] == "123 Main Street"
    assert fields["customer_name"] == "Northwind Finance"
    assert fields["customer_address"] == "500 Market Street"
    assert fields["document_title"] == "INVOICE"


def test_german_invoice_labels_amounts_and_date_order():
    assert classify(GERMAN_INVOICE) == "invoice"
    fields = extract_rules(GERMAN_INVOICE)

    assert fields["document_number"] == "DE-2026-77"
    assert fields["vendor_name"] == "Müller GmbH"
    assert fields["customer_name"] == "Nordwind AG"
    assert fields["issue_date"] == "2026-03-04"
    assert fields["due_date"] == "2026-04-03"
    assert fields["currency"] == "EUR"
    assert fields["subtotal"] == "1000.00"
    assert fields["tax_amount"] == "190.00"
    assert fields["total_amount"] == "1190.00"
    assert fields["vendor_name"] != "rdwind"


def test_grand_total_wins_over_a_line_item_that_contains_total():
    fields = extract_rules(
        """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
Consulting Total 100.00
Grand Total: 1,234.50
"""
    )

    assert fields["total_amount"] == "1234.50"


def test_grand_total_beats_a_later_generic_total_line():
    fields = extract_rules(
        """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
Grand Total: 1,234.50
Total: 1,000.00
"""
    )

    assert fields["total_amount"] == "1234.50"


def test_due_date_is_not_copied_into_a_missing_issue_date():
    fields = extract_rules(
        """Acme Supply
Invoice Number: A-1
Due Date: 2026-04-13
Currency: USD
Total: 100.00
"""
    )

    assert "issue_date" not in fields
    assert fields["due_date"] == "2026-04-13"

    warnings, requires_review = validate(
        [{"key": key, "value": value} for key, value in fields.items()]
    )
    assert "missing_required:issue_date" in warnings
    assert requires_review is True


def test_line_items_support_single_spaced_columns_and_validate_math():
    items = extract_line_items(US_INVOICE)

    assert [item["description"] for item in items] == ["Widget A", "Service fee"]
    assert [item["quantity"] for item in items] == ["2.00", "1.00"]
    assert [item["amount"] for item in items] == ["20.00", "80.00"]
    assert Decimal(items[0]["quantity"]) * Decimal(items[0]["unit_price"]) == Decimal(items[0]["amount"])


def test_shipping_fee_is_a_line_item_not_a_summary_row():
    items = extract_line_items(
        """Widget A 2 10.00 20.00
Shipping 1 5.00 5.00
Subtotal: 25.00
"""
    )

    assert [item["description"] for item in items] == ["Widget A", "Shipping"]


def test_multiplier_rows_are_line_items_and_tax_included_total_is_kept():
    text = """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
Widget A 2 x 10.00 20.00
Total (tax included): 20.00
"""

    fields = extract_rules(text)

    assert fields["total_amount"] == "20.00"
    assert extract_line_items(text) == [
        {"description": "Widget A", "quantity": "2.00", "unit_price": "10.00", "amount": "20.00"}
    ]


def test_spanish_customer_label_does_not_lose_its_first_letter():
    fields = extract_rules(
        """Suministros Sol SL
Factura Nº ES-77
Fecha de factura: 04/03/2026
Cliente: Norte SA
Moneda: EUR
Total a pagar: 100,00
"""
    )

    assert fields["customer_name"] == "Norte SA"


def test_german_compound_document_number_and_french_number_label():
    german = extract_rules(
        """Müller GmbH
Rechnungsnummer: DE-1
Rechnungsdatum: 04.03.2026
Währung: EUR
Gesamtbetrag: 10,00
"""
    )
    french = extract_rules(
        """Atelier Lumen SARL
N° de facture : FR-1
Date de facture : 04/03/2026
Devise : EUR
Total TTC : 10,00
"""
    )

    assert german["document_number"] == "DE-1"
    assert french["document_number"] == "FR-1"


def test_document_number_does_not_match_inside_a_company_name():
    fields = extract_rules(
        """Northwind Finance
Invoice Date: 2026-03-04
Currency: USD
Total: 10.00
"""
    )

    assert "document_number" not in fields


def test_invalid_iban_is_not_emitted_and_lowercase_is_normalized():
    invalid = extract_rules(
        """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
IBAN: GB00BUKB20201555555555
Total: 10.00
"""
    )
    valid = extract_rules(
        """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
IBAN: gb33bukb20201555555555
Total: 10.00
"""
    )

    assert "iban" not in invalid
    assert valid["iban"] == "GB33BUKB20201555555555"


def test_tax_id_is_not_mistaken_for_a_tax_amount():
    fields = extract_rules(
        """Acme GmbH
Rechnungsdatum: 04.03.2026
USt-IdNr.: DE123456789
Währung: EUR
Zwischensumme: 100,00
MwSt 19%: 19,00
Gesamtbetrag: 119,00
"""
    )

    assert fields["tax_amount"] == "19.00"
    assert fields["vendor_tax_id"] == "DE123456789"


def test_administrative_labels_are_never_vendor_names():
    only_labels = """Currency: USD
IBAN: GB33BUKB20201555555555
Payment Terms: Net 30
Invoice Date: 2026-03-04
Total: 100.00
"""
    labels_then_company = """Currency: USD
Acme Supply
Invoice Date: 2026-03-04
Total: 100.00
"""

    assert "vendor_name" not in extract_rules(only_labels)
    assert extract_rules(only_labels)["payment_terms"] == "Net 30"
    assert extract_rules(labels_then_company)["vendor_name"] == "Acme Supply"


def test_currency_code_needs_amount_context_and_totals_are_not_vendors():
    company_with_code = """Acme USD Holdings
Invoice Date: 2026-03-04
Total: 100.00
"""
    amounts_in_code = """All amounts in USD
Acme Supply
Invoice Date: 2026-03-04
Total: 100.00
"""
    only_total = """Grand Total: 100.00
Invoice Date: 2026-03-04
"""

    assert "currency" not in extract_rules(company_with_code)
    assert extract_rules(company_with_code)["vendor_name"] == "Acme USD Holdings"
    assert extract_rules(amounts_in_code)["currency"] == "USD"
    assert extract_rules(amounts_in_code)["vendor_name"] == "Acme Supply"
    assert "vendor_name" not in extract_rules(only_total)


def test_payment_terms_require_a_real_term_not_generic_prose():
    generic = """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
Payment Terms: Please see our terms and conditions
Total: 100.00
"""
    net = """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
Payment Terms: Net 30
Total: 100.00
"""
    days = """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
Payment Terms: 30 days
Total: 100.00
"""

    assert "payment_terms" not in extract_rules(generic)
    assert extract_rules(net)["payment_terms"] == "Net 30"
    assert extract_rules(days)["payment_terms"] == "30 days"


def test_full_pipeline_us_and_german(monkeypatch):
    monkeypatch.setenv("PROCESSOR_AI_ENABLED", "false")
    from app.config import get_settings

    get_settings.cache_clear()
    cases = [
        (
            US_INVOICE,
            {
                "vendor_name": "NORTHSTAR SUPPLY LLC",
                "customer_name": "Contoso Finance",
                "issue_date": "2026-03-04",
                "due_date": "2026-04-03",
                "currency": "USD",
                "subtotal": "100.00",
                "tax_amount": "8.25",
                "total_amount": "108.25",
            },
        ),
        (
            GERMAN_INVOICE,
            {
                "vendor_name": "Müller GmbH",
                "customer_name": "Nordwind AG",
                "document_number": "DE-2026-77",
                "issue_date": "2026-03-04",
                "due_date": "2026-04-03",
                "currency": "EUR",
                "subtotal": "1000.00",
                "tax_amount": "190.00",
                "total_amount": "1190.00",
            },
        ),
    ]

    for text, expected in cases:
        fields, kind, language, warnings, model = extract(text)
        by_key = {field["key"]: field["value"] for field in fields}
        assert kind == "invoice"
        assert model is None
        assert "ai_extraction_failed" not in warnings
        for key, value in expected.items():
            assert by_key[key] == value, (key, by_key.get(key))
        issues, requires_review = validate(fields)
        assert requires_review is False, issues
        assert language in {"en", "de", "fr", "es", None}


def test_payable_label_and_po_number_are_recognized():
    fields = extract_rules(
        """Acme Supply
Invoice Date: 2026-03-04
Currency: USD
PO Number: PO-9911
Amount Payable: 108.25
"""
    )

    assert fields["purchase_order"] == "PO-9911"
    assert fields["total_amount"] == "108.25"


def test_date_order_can_be_explicit_and_supports_localized_months():
    assert normalize_date("03/04/2026", "mdy") == "2026-03-04"
    assert normalize_date("03/04/2026", "dmy") == "2026-04-03"
    assert normalize_date("04.03.2026", "dmy") == "2026-03-04"
    assert normalize_date("4. März 2026", "dmy") == "2026-03-04"


def test_validation_flags_line_items_that_do_not_match_subtotal_and_bad_totals():
    line_warnings, _ = validate(
        [
            {"key": "vendor_name", "value": "Acme"},
            {"key": "issue_date", "value": "2026-03-04"},
            {"key": "currency", "value": "USD"},
            {"key": "subtotal", "value": "100.00"},
            {"key": "total_amount", "value": "100.00"},
            {"key": "line_items", "value": '[{"description": "A", "amount": "80.00"}]'},
        ]
    )
    total_warnings, _ = validate(
        [
            {"key": "vendor_name", "value": "Acme"},
            {"key": "issue_date", "value": "2026-03-04"},
            {"key": "currency", "value": "USD"},
            {"key": "subtotal", "value": "120.00"},
            {"key": "total_amount", "value": "100.00"},
        ]
    )

    assert "line_items_inconsistent" in line_warnings
    assert "subtotal_exceeds_total" in total_warnings
