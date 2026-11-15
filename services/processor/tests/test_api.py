from fastapi.testclient import TestClient

from app.main import app


def test_health_is_public_and_reports_version():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_enqueue_requires_internal_token():
    with TestClient(app) as client:
        response = client.post(
            "/internal/jobs",
            json={"jobId": "job-1", "type": "document_process", "correlationId": "corr-1", "attempt": 1},
        )
    assert response.status_code == 401


def test_enqueue_rejects_wrong_token():
    with TestClient(app) as client:
        response = client.post(
            "/internal/jobs",
            headers={"x-internal-token": "definitely-not-the-token"},
            json={"jobId": "job-1", "type": "document_process", "correlationId": "corr-1", "attempt": 1},
        )
    assert response.status_code == 401


def test_enqueue_validates_payload():
    with TestClient(app) as client:
        response = client.post(
            "/internal/jobs",
            headers={"x-internal-token": "test-internal-token"},
            json={"jobId": "job-1", "type": "not_a_job", "correlationId": "corr-1"},
        )
    assert response.status_code == 422
