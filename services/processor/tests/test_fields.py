from app.pipeline.fields import build_fields, normalize_currency, normalize_date, normalize_decimal


def test_normalize_date_iso_and_day_first():
    assert normalize_date("2026-03-14") == "2026-03-14"
    assert normalize_date("14/03/2026") == "2026-03-14"
    assert normalize_date("03/14/2026") == "2026-03-14"
    assert normalize_date("14 Mar 2026") == "2026-03-14"
    assert normalize_date("Mar 14, 2026") == "2026-03-14"
    assert normalize_date("31/02/2026") is None
    assert normalize_date("not a date") is None


def test_normalize_decimal_comma_and_thousands():
    assert normalize_decimal("1,234.50") == "1234.50"
    assert normalize_decimal("1.234,50") == "1234.50"
    assert normalize_decimal("€ 1 234,50") == "1234.50"
    assert normalize_decimal("(1,234.50)") == "-1234.50"
    assert normalize_decimal("1200-") == "-1200.00"
    assert normalize_decimal("abc") is None


def test_normalize_currency():
    assert normalize_currency("USD") == "USD"
    assert normalize_currency("$") == "USD"
    assert normalize_currency("€") == "EUR"
    assert normalize_currency("Amount in GBP") == "GBP"


def test_build_fields_ignores_unknown_and_normalises():
    fields = build_fields(
        {
            "vendor_name": "Acme",
            "issue_date": "14/03/2026",
            "total_amount": "1.234,50",
            "line_items": [{"description": "Widget", "amount": "10.00"}],
            "unexpected_key": "ignored",
            "currency": None,
        }
    )
    by_key = {field["key"]: field for field in fields}
    assert by_key["issue_date"]["value"] == "2026-03-14"
    assert by_key["total_amount"]["value"] == "1234.50"
    assert by_key["line_items"]["value"].startswith("[")
    assert "unexpected_key" not in by_key
    assert "currency" not in by_key
