"""
UrbanFootprint AI - FastAPI Integration Tests
Tests health, model info, image upload validation, job creation, and error handling.
"""

import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app

client = TestClient(app)


def test_api_health():
    """Verify GET /api/health returns 200 and expected schema"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "app_name" in data
    assert "database_connected" in data


def test_api_model_info():
    """Verify GET /api/model/info returns model architecture and device status"""
    response = client.get("/api/model/info")
    assert response.status_code == 200
    data = response.json()
    assert "model_architecture" in data
    assert "device" in data
    assert "cuda_available" in data


def test_api_stats():
    """Verify GET /api/stats returns statistics structure"""
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_jobs" in data
    assert "total_buildings_detected" in data


def test_upload_invalid_file_extension():
    """Verify POST /api/jobs rejects unsupported file formats with 400"""
    fake_txt = io.BytesIO(b"Hello world, this is not an image.")
    response = client.post(
        "/api/jobs",
        files={"image": ("notes.txt", fake_txt, "text/plain")},
        data={"confidence_threshold": 0.5},
    )
    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


def test_job_creation_and_execution_demo():
    """Verify end-to-end job upload and immediate job status response"""
    # Create valid synthetic test image
    img = Image.new("RGB", (128, 128), color=(100, 150, 200))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    response = client.post(
        "/api/jobs",
        files={"image": ("synthetic_test.png", img_byte_arr, "image/png")},
        data={
            "confidence_threshold": 0.5,
            "tile_size": 256,
            "tile_overlap": 32,
            "min_polygon_area": 10.0,
            "allow_demo_mode": "true",
        },
    )
    assert response.status_code == 202
    job = response.json()
    assert "id" in job
    assert job["id"].startswith("uf-")
    assert job["original_filename"] == "synthetic_test.png"

    job_id = job["id"]
    # Check job fetch
    fetch_res = client.get(f"/api/jobs/{job_id}")
    assert fetch_res.status_code == 200
    assert fetch_res.json()["id"] == job_id
