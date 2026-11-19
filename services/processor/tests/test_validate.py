from app.pipeline.validate import validate


def _fields(**values):
    return [{"key": key, "value": value, "confidence": 0.9} for key, value in values.items()]


def test_consistent_extraction_passes():
    warnings, review = validate(
        _fields(
            vendor_name="Acme Supply",
            issue_date="2026-03-14",
            due_date="2026-04-13",
            currency="USD",
            subtotal="1000.00",
            tax_amount="200.00",
            total_amount="1200.00",
        )
    )
    assert warnings == []
    assert review is False


def test_totals_mismatch_requires_review():
    warnings, review = validate(
        _fields(
            vendor_name="Acme",
            issue_date="2026-03-14",
            currency="USD",
            subtotal="1000.00",
            tax_amount="200.00",
            total_amount="1250.00",
        )
    )
    assert "totals_inconsistent" in warnings
    assert review is True


def test_discount_is_subtracted_before_total_checks():
    warnings, review = validate(
        _fields(
            vendor_name="Acme Supply",
            issue_date="2026-03-14",
            currency="USD",
            subtotal="1000.00",
            discount_amount="100.00",
            tax_amount="74.25",
            total_amount="974.25",
        )
    )
    assert warnings == []
    assert review is False


def test_discount_that_does_not_reconcile_requires_review():
    warnings, review = validate(
        _fields(
            vendor_name="Acme Supply",
            issue_date="2026-03-14",
            currency="USD",
            subtotal="1000.00",
            discount_amount="100.00",
            tax_amount="180.00",
            total_amount="1200.00",
        )
    )
    assert "totals_inconsistent" in warnings
    assert review is True


def test_due_before_issue_and_missing_fields():
    warnings, review = validate(_fields(issue_date="2026-05-01", due_date="2026-04-01", total_amount="10.00"))
    assert "due_before_issue" in warnings
    assert "missing_required:vendor_name" in warnings
    assert "missing_required:currency" in warnings
    assert review is True


def test_negative_total():
    warnings, _ = validate(
        _fields(vendor_name="Acme", issue_date="2026-03-14", currency="USD", total_amount="-10.00")
    )
    assert "negative_total" in warnings
