"""Export artefact generation."""

from __future__ import annotations

import csv
import io
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

CSV_CONTENT_TYPE = "text/csv; charset=utf-8"
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _safe_cell(value: Any) -> Any:
    """Neutralises spreadsheet formulas while preserving numeric cells."""
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    text = str(value)
    if text.startswith(FORMULA_PREFIXES):
        return "'" + text
    return text[:32_000]


def build_csv(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({column: _safe_cell(row.get(column)) for column in columns})
    return buffer.getvalue().encode("utf-8")


def build_xlsx(columns: list[str], rows: list[dict[str, Any]], sheet_title: str = "Documents") -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = sheet_title[:31]

    header_fill = PatternFill("solid", fgColor="EFEFFF")
    for index, column in enumerate(columns, start=1):
        cell = sheet.cell(row=1, column=index, value=column)
        cell.font = Font(bold=True, size=10)
        cell.fill = header_fill

    for row_index, row in enumerate(rows, start=2):
        for column_index, column in enumerate(columns, start=1):
            sheet.cell(row=row_index, column=column_index, value=_safe_cell(row.get(column)))

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:{get_column_letter(max(1, len(columns)))}{max(1, len(rows) + 1)}"
    for index, column in enumerate(columns, start=1):
        width = min(48, max(12, len(column) + 2))
        sheet.column_dimensions[get_column_letter(index)].width = width

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def build_export(fmt: str, columns: list[str], rows: list[dict[str, Any]]) -> tuple[bytes, str]:
    if fmt == "xlsx":
        return build_xlsx(columns, rows), XLSX_CONTENT_TYPE
    return build_csv(columns, rows), CSV_CONTENT_TYPE
