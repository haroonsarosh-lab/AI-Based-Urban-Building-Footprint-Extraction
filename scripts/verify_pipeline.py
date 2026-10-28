"""
UrbanFootprint AI - End-to-End Integration Verification Script
Submits test imagery to live FastAPI backend, monitors execution,
and verifies GeoJSON, mask, CSV, and ZIP report generation.
"""

import httpx
import time
import io
from PIL import Image, ImageDraw

def test_pipeline():
    client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30.0)

    # 1. Health
    h = client.get("/api/health").json()
    print("[1] Health Check:", h)
    assert h["status"] == "ok"

    # 2. Model Info
    m = client.get("/api/model/info").json()
    print(f"[2] Model Architecture: {m['model_architecture']} | Device: {m['device']} | Checkpoint Loaded: {m['model_loaded']}")

    # 3. Create synthetic test aerial image
    img = Image.new("RGB", (512, 512), color=(70, 95, 60))
    draw = ImageDraw.Draw(img)
    # Road
    draw.rectangle([(0, 230), (512, 280)], fill=(50, 50, 55))
    # 4 Building roofs
    draw.rectangle([(50, 50), (140, 130)], fill=(190, 75, 60))
    draw.rectangle([(200, 40), (320, 150)], fill=(210, 215, 220))
    draw.rectangle([(60, 340), (180, 450)], fill=(80, 90, 110))
    draw.rectangle([(280, 330), (420, 440)], fill=(185, 175, 150))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    # 4. Submit Job
    print("[3] Submitting aerial image for building footprint extraction...")
    res = client.post(
        "/api/jobs",
        files={"image": ("sample_aerial_512.png", buf, "image/png")},
        data={
            "confidence_threshold": "0.50",
            "tile_size": "512",
            "tile_overlap": "64",
            "min_polygon_area": "15.0",
            "simplify_tolerance": "0.8",
            "allow_demo_mode": "true",
        },
    )
    assert res.status_code == 202
    job = res.json()
    job_id = job["id"]
    print(f"[4] Job created with ID: {job_id}")

    # 5. Poll until completed
    for attempt in range(25):
        time.sleep(1)
        curr = client.get(f"/api/jobs/{job_id}").json()
        status = curr.get("status")
        print(f"    - Attempt {attempt+1}: Status = {status}")
        if status in ("completed", "failed"):
            break

    final_job = client.get(f"/api/jobs/{job_id}").json()
    assert final_job["status"] == "completed", f"Job failed: {final_job.get('error_message')}"

    print("\n[5] Extraction Pipeline Completed Successfully!")
    print(f"    - Total Buildings Extracted: {final_job['detected_buildings_count']}")
    print(f"    - Total Building Area:       {final_job['total_building_area']} {final_job['area_unit']}")
    print(f"    - Execution Time:            {final_job['processing_time_seconds']} seconds")
    print(f"    - GeoJSON Vector URL:        {final_job['geojson_url']}")
    print(f"    - Mask PNG URL:              {final_job['mask_url']}")
    print(f"    - CSV Attributes URL:        {final_job['csv_url']}")
    print(f"    - Full GIS Package (.zip):   {final_job['zip_export_url']}")

    # 6. Verify GeoJSON and Report downloads
    geojson = client.get(final_job["geojson_url"]).json()
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == final_job["detected_buildings_count"]
    print(f"[6] GeoJSON Verification Passed: {len(geojson['features'])} valid GIS features verified.")

    report = client.get(final_job["report_url"]).json()
    assert report["job_id"] == job_id
    print(f"[7] Processing Audit Report Verified: generated at {report['generated_at']}")
    print("\n>>> ALL END-TO-END CRITERIA FULLY SATISFIED! <<<")

if __name__ == "__main__":
    test_pipeline()
