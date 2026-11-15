import os

os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-internal-token")
os.environ.setdefault("PROCESSOR_AI_ENABLED", "false")
os.environ.setdefault("PROCESSOR_OCR_ENABLED", "true")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6399/15")
os.environ.setdefault("WEB_INTERNAL_URL", "http://127.0.0.1:3000")
os.environ.setdefault("NODE_ENV", "test")
