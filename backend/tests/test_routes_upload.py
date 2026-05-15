from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_upload_no_file():
    resp = client.post("/api/upload")
    assert resp.status_code == 422
