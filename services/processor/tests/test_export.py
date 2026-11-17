import io

from openpyxl import load_workbook

from app.pipeline.export import CSV_CONTENT_TYPE, XLSX_CONTENT_TYPE, build_export
from app.tasks import _failure_from, generate_export
from app.web_client import StorageTransferError


def test_csv_export_neutralises_formulas():
    columns = ["document_id", "vendor_name", "total_amount"]
    rows = [{"document_id": "doc-1", "vendor_name": "=cmd|' /C calc'!A0", "total_amount": "12.50"}]
    content, content_type = build_export("csv", columns, rows)
    assert content_type == CSV_CONTENT_TYPE
    text = content.decode("utf-8")
    assert text.splitlines()[0] == "document_id,vendor_name,total_amount"
    assert "'=cmd|' /C calc'!A0" in text
    assert text.splitlines()[1].startswith("doc-1,")


class FakeExportClient:
    def __init__(self) -> None:
        self.uploaded: tuple[str, bytes, dict[str, str]] | None = None
        self.completed: dict[str, object] | None = None

    def export_rows(self, _export_id: str, _correlation_id: str):
        return {
            "format": "csv",
            "columns": ["document_id", "total_amount"],
            "rows": [{"document_id": "doc-1", "total_amount": "12.50"}],
        }

    def export_upload_target(self, _export_id: str, content_type: str, _correlation_id: str):
        return {
            "uploadUrl": "https://storage.example/upload",
            "storageKey": "workspaces/w/exports/e.csv",
            "headers": {
                "Content-Type": content_type,
                "x-upsert": "false",
                "cache-control": "max-age=3600",
            },
        }

    def upload(self, url: str, content: bytes, headers: dict[str, str]) -> None:
        self.uploaded = (url, content, headers)

    def complete_export(self, _export_id: str, _worker_id: str, payload: dict[str, object], _correlation_id: str) -> None:
        self.completed = payload


def test_export_upload_forwards_provider_headers():
    client = FakeExportClient()

    generate_export(client, "job-1", {"export": {"id": "export-1", "format": "csv"}}, "corr-1")

    assert client.uploaded is not None
    _url, content, headers = client.uploaded
    assert content_type_is_csv(content)
    assert headers["x-upsert"] == "false"
    assert headers["cache-control"] == "max-age=3600"
    assert client.completed == {"storageKey": "workspaces/w/exports/e.csv", "sizeBytes": len(content), "rowCount": 1}


def content_type_is_csv(content: bytes) -> bool:
    return content.startswith(b"document_id,total_amount")


def test_upload_failure_is_not_reported_as_a_document_download():
    error = StorageTransferError(
        "upload",
        "The export could not be uploaded to storage (storage returned 400: mime type not allowed).",
        status_code=400,
        category="permanent",
    )

    code, message, category = _failure_from(error)

    assert code == "export_upload_failed"
    assert "storage returned 400" in message
    assert category == "permanent"


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
