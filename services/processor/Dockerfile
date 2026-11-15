# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f services/processor/Dockerfile -t parsepilot-processor .
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY services/processor/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/processor/app ./app

RUN groupadd --system --gid 1001 processor \
  && useradd --system --uid 1001 --gid processor processor \
  && chown -R processor:processor /app
USER processor

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
