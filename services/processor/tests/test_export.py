import io

from openpyxl import load_workbook

from app.pipeline.export import CSV_CONTENT_TYPE, XLSX_CONTENT_TYPE, build_export


def test_csv_export_neutralises_formulas():
    columns = ["document_id", "vendor_name", "total_amount"]
    rows = [{"document_id": "doc-1", "vendor_name": "=cmd|' /C calc'!A0", "total_amount": "12.50"}]
    content, content_type = build_export("csv", columns, rows)
    assert content_type == CSV_CONTENT_TYPE
    text = content.decode("utf-8")
    assert text.splitlines()[0] == "document_id,vendor_name,total_amount"
    assert "'=cmd|' /C calc'!A0" in text
    assert text.splitlines()[1].startswith("doc-1,")


def test_xlsx_export_roundtrip():
    columns = ["document_id", "vendor_name", "total_amount"]
    rows = [
        {"document_id": "doc-1", "vendor_name": "Acme", "total_amount": "12.50"},
        {"document_id": "doc-2", "vendor_name": "@SUM(A1:A2)", "total_amount": 0},
    ]
    content, content_type = build_export("xlsx", columns, rows)
    assert content_type == XLSX_CONTENT_TYPE
    workbook = load_workbook(io.BytesIO(content))
    sheet = workbook.active
    assert sheet["A1"].value == "document_id"
    assert sheet["B2"].value == "Acme"
    assert sheet["B3"].value == "'@SUM(A1:A2)"
    assert sheet.freeze_panes == "A2"
