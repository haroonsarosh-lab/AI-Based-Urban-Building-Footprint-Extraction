"""
UrbanFootprint AI - FastAPI Endpoints
Implements the REST API endpoints for building footprint extraction, job management,
GIS downloads, and model status.
"""

import os
import uuid
import json
import time
import shutil
from typing import Optional, List
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
    BackgroundTasks,
    status,
)
from fastapi.responses import FileResponse, JSONResponse

from backend.app.core.config import settings
from backend.app.schemas.jobs import HealthResponse, ModelInfoResponse, JobResponse
from backend.app.db.database import (
    create_job_record,
    get_job_by_id,
    list_jobs,
    get_job_stats,
    update_job_record,
)
from backend.app.services.job_service import (
    get_inference_engine,
    execute_extraction_job,
    reload_inference_engine,
)

router = APIRouter(prefix="/api")


def _format_job_response(job: dict) -> dict:
    """Appends download URLs for frontend consumption"""
    job_id = job["id"]
    base = f"/api/jobs/{job_id}/download"
    return {
        **job,
        "image_url": f"{base}/image" if job.get("image_path") else None,
        "mask_url": f"{base}/mask" if job.get("mask_path") else None,
        "prob_map_url": f"{base}/prob" if job.get("prob_map_path") else None,
        "geojson_url": f"{base}/geojson" if job.get("geojson_path") else None,
        "csv_url": f"{base}/csv" if job.get("csv_path") else None,
        "zip_export_url": f"{base}/zip" if job.get("zip_export_path") else None,
        "report_url": f"/api/jobs/{job_id}/report" if job.get("report_path") else None,
    }


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Health status of backend service and model readiness"""
    engine = get_inference_engine()
    return {
        "status": "ok",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "database_connected": os.path.exists(settings.db_path),
        "model_loaded": engine.model_loaded,
    }


@router.get("/model/info", response_model=ModelInfoResponse)
def get_model_info():
    """Returns honest model and checkpoint metadata"""
    engine = get_inference_engine()
    return engine.get_info()


@router.get("/stats")
def get_dashboard_stats():
    """Operational metrics and recent processing jobs"""
    return get_job_stats()


@router.get("/jobs")
def get_all_jobs(limit: int = 50, offset: int = 0):
    """Lists recent extraction jobs"""
    jobs = list_jobs(limit=limit, offset=offset)
    return [_format_job_response(j) for j in jobs]


@router.get("/jobs/{job_id}")
def get_single_job(job_id: str):
    """Retrieves full details and artifact links for a single job"""
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return _format_job_response(job)


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
async def create_extraction_job(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    parcels: Optional[UploadFile] = File(None),
    confidence_threshold: float = Form(0.50),
    tile_size: int = Form(512),
    tile_overlap: int = Form(64),
    min_polygon_area: float = Form(15.0),
    simplify_tolerance: float = Form(0.8),
    allow_demo_mode: bool = Form(False),
):
    """
    Uploads aerial/satellite imagery and initiates building footprint extraction.
    Validates MIME type, file extension, and runs processing asynchronously.
    """
    # 1. Validate file extension and format
    allowed_exts = [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".geotiff"]
    ext = os.path.splitext(image.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image extension '{ext}'. Allowed: {', '.join(allowed_exts)}",
        )

    # 2. Check model readiness
    engine = get_inference_engine()
    if not engine.model_loaded and not allow_demo_mode:
        raise HTTPException(
            status_code=409,
            detail=(
                "No trained segmentation checkpoint is loaded on the server. "
                "Train or provide model weights in data/checkpoints/ or check 'allow_demo_mode' "
                "to run the clearly labeled synthetic verification pipeline."
            ),
        )

    # 3. Save uploaded image to disk safely
    job_id = f"uf-{uuid.uuid4().hex[:10]}"
    upload_filename = f"{job_id}_{image.filename}"
    upload_path = os.path.join(settings.upload_dir, upload_filename)

    file_size = 0
    try:
        with open(upload_path, "wb") as buffer:
            while content := await image.read(1024 * 1024):  # 1MB chunks
                file_size += len(content)
                buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded image: {str(e)}")

    # 4. Optional parcel GeoJSON parsing
    parcel_data = None
    if parcels:
        try:
            parcel_content = await parcels.read()
            parcel_data = json.loads(parcel_content.decode("utf-8"))
        except Exception as e:
            # Continue without parcel spatial join, but log notice
            pass

    # 5. Create DB Record
    create_job_record({
        "id": job_id,
        "status": "pending",
        "original_filename": image.filename,
        "file_size_bytes": file_size,
        "mime_type": image.content_type,
        "confidence_threshold": confidence_threshold,
        "tile_size": tile_size,
        "tile_overlap": tile_overlap,
        "min_polygon_area": min_polygon_area,
        "simplify_tolerance": simplify_tolerance,
        "image_path": upload_path,
        "is_demo_mode": allow_demo_mode and not engine.model_loaded,
        "warnings": [],
    })

    # 6. Launch background execution task
    background_tasks.add_task(
        execute_extraction_job,
        job_id=job_id,
        image_path=upload_path,
        confidence_threshold=confidence_threshold,
        tile_size=tile_size,
        tile_overlap=tile_overlap,
        min_polygon_area=min_polygon_area,
        simplify_tolerance=simplify_tolerance,
        allow_demo_mode=allow_demo_mode,
        parcel_geojson_data=parcel_data,
    )

    return _format_job_response(get_job_by_id(job_id))


@router.post("/jobs/{job_id}/retry")
def retry_failed_job(job_id: str, background_tasks: BackgroundTasks):
    """Retries a previously failed or completed job"""
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.get("image_path") or not os.path.exists(job["image_path"]):
        raise HTTPException(status_code=400, detail="Source image is no longer available on disk")

    update_job_record(job_id, {"status": "pending", "error_message": None})

    background_tasks.add_task(
        execute_extraction_job,
        job_id=job_id,
        image_path=job["image_path"],
        confidence_threshold=job.get("confidence_threshold", 0.5),
        tile_size=job.get("tile_size", 512),
        tile_overlap=job.get("tile_overlap", 64),
        min_polygon_area=job.get("min_polygon_area", 15.0),
        simplify_tolerance=job.get("simplify_tolerance", 0.8),
        allow_demo_mode=bool(job.get("is_demo_mode", False)),
    )

    return {"message": f"Job {job_id} scheduled for retry", "status": "pending"}


@router.get("/jobs/{job_id}/report")
def get_job_report(job_id: str):
    """Retrieves the comprehensive JSON processing report"""
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    report_path = job.get("report_path")
    if not report_path or not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Processing report not yet generated")

    with open(report_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data)


@router.get("/jobs/{job_id}/download/{artifact}")
def download_job_artifact(job_id: str, artifact: str):
    """
    Downloads result artifacts:
    - 'geojson': GeoJSON polygon vector file
    - 'mask': Binary segmentation mask PNG
    - 'prob': Probability map visualization PNG
    - 'csv': Tabular building attributes CSV
    - 'zip': Full GIS export bundle ZIP
    - 'report': JSON processing report
    - 'image': Original input image
    """
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    artifact_map = {
        "geojson": (job.get("geojson_path"), f"urbanfootprint_{job_id}_buildings.geojson", "application/geo+json"),
        "mask": (job.get("mask_path"), f"urbanfootprint_{job_id}_mask.png", "image/png"),
        "prob": (job.get("prob_map_path"), f"urbanfootprint_{job_id}_prob.png", "image/png"),
        "csv": (job.get("csv_path"), f"urbanfootprint_{job_id}_attributes.csv", "text/csv"),
        "zip": (job.get("zip_export_path"), f"urbanfootprint_{job_id}_export.zip", "application/zip"),
        "report": (job.get("report_path"), f"urbanfootprint_{job_id}_report.json", "application/json"),
        "image": (job.get("image_path"), job.get("original_filename", "image.png"), "image/png"),
    }

    if artifact not in artifact_map:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid artifact '{artifact}'. Allowed: {list(artifact_map.keys())}",
        )

    file_path, filename, media_type = artifact_map[artifact]
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Artifact '{artifact}' not found for job {job_id}")

    return FileResponse(path=file_path, filename=filename, media_type=media_type)
