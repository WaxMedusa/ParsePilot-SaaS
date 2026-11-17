"""Text acquisition: native PDF text first, OCR only where it is needed."""

from __future__ import annotations

import io
from collections.abc import Callable
from dataclasses import dataclass, field

import fitz  # PyMuPDF

from ..config import get_settings


class PipelineError(RuntimeError):
    """A classified failure that is safe to report to the web service."""

    def __init__(self, code: str, message: str, category: str = "permanent", retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.category = category
        self.retryable = retryable


@dataclass
class ExtractedText:
    pages: list[str] = field(default_factory=list)
    ocr_used: bool = False
    page_count: int = 0

    @property
    def text(self) -> str:
        return "\n\n".join(self.pages).strip()


def _ocr_page(page: "fitz.Page") -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as error:  # pragma: no cover - deployment guard
        raise PipelineError(
            "ocr_unavailable",
            "OCR dependencies are not installed in this worker image.",
            category="provider",
        ) from error

    pixmap = page.get_pixmap(dpi=300, colorspace=fitz.csGRAY)
    image = Image.open(io.BytesIO(pixmap.tobytes("png")))
    try:
        return pytesseract.image_to_string(image, lang="eng")
    except Exception as error:  # noqa: BLE001 - tesseract reports many error types
        raise PipelineError(
            "ocr_unavailable",
            "The OCR engine (tesseract) is not available in this worker image.",
            category="provider",
        ) from error


def extract_text(data: bytes, mime_type: str, on_ocr: Callable[[], None] | None = None) -> ExtractedText:
    settings = get_settings()
    if not data:
        raise PipelineError("empty_file", "The stored file is empty.")

    if mime_type == "application/pdf" or data[:5] == b"%PDF-":
        try:
            document = fitz.open(stream=data, filetype="pdf")
        except Exception as error:  # noqa: BLE001
            raise PipelineError("corrupt_pdf", "The PDF could not be opened.") from error

        try:
            if document.needs_pass:
                raise PipelineError("encrypted_pdf", "Password-protected PDFs are not supported.")
            if document.page_count == 0:
                raise PipelineError("empty_document", "The PDF contains no pages.")
            if document.page_count > settings.max_pages:
                raise PipelineError(
                    "page_limit_exceeded",
                    f"The document has {document.page_count} pages; the limit is {settings.max_pages}.",
                )

            pages: list[str] = []
            ocr_used = False
            ocr_pages = 0
            for page in document:
                # Sort by visual position so two-column invoices do not
                # interleave the bill-to block with line-item amounts.
                text = page.get_text("text", sort=True) or ""
                if len(text.strip()) < 24 and settings.ocr_enabled:
                    if ocr_pages >= settings.ocr_max_pages:
                        raise PipelineError(
                            "ocr_page_limit_exceeded",
                            f"OCR is limited to {settings.ocr_max_pages} pages per document.",
                        )
                    if on_ocr is not None and not ocr_used:
                        on_ocr()
                    text = _ocr_page(page)
                    ocr_used = True
                    ocr_pages += 1
                pages.append(text.strip())
            return ExtractedText(pages=pages, ocr_used=ocr_used, page_count=document.page_count)
        finally:
            document.close()

    if mime_type in {"image/png", "image/jpeg", "image/tiff", "image/webp"} or data[:4] in {
        b"\x89PNG",
        b"\xff\xd8\xff\xe0",
        b"\xff\xd8\xff\xe1",
        b"II*\x00",
        b"MM\x00*",
        b"RIFF",
    }:
        if not settings.ocr_enabled:
            raise PipelineError("ocr_disabled", "OCR is disabled on this deployment.", category="provider")
        if on_ocr is not None:
            on_ocr()
        try:
            import pytesseract
            from PIL import Image
        except ImportError as error:  # pragma: no cover
            raise PipelineError("ocr_unavailable", "OCR dependencies are not installed.", category="provider") from error

        try:
            image = Image.open(io.BytesIO(data))
            image.load()
            # Small receipt/invoice images are common. Upscaling before OCR
            # makes the date and tax columns legible without affecting large
            # scans; grayscale also removes palette noise from template images.
            if image.width < 1_200:
                scale = min(2.5, 1_600 / max(1, image.width))
                image = image.resize(
                    (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                    Image.Resampling.LANCZOS,
                )
            text = pytesseract.image_to_string(image.convert("L"), lang="eng")
        except Exception as error:  # noqa: BLE001
            raise PipelineError(
                "ocr_unavailable",
                "The OCR engine (tesseract) is not available in this worker image.",
                category="provider",
            ) from error
        return ExtractedText(pages=[text.strip()], ocr_used=True, page_count=1)

    raise PipelineError("unsupported_file_type", f"Unsupported file type: {mime_type or 'unknown'}.")
