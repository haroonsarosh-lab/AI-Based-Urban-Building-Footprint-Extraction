"""
UrbanFootprint AI - Pydantic Data Models & Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class HealthResponse(BaseModel):
    status: str = "ok"
    app_name: str
    version: str
    timestamp: str
    database_connected: bool
    model_loaded: bool


class ModelInfoResponse(BaseModel):
    model_architecture: str
    model_loaded: bool
    checkpoint_path: Optional[str]
    is_synthetic_checkpoint: bool
    device: str
    cuda_available: bool
    load_error: Optional[str]
    checkpoint_metadata: Dict[str, Any]
    default_tile_size: int
    default_overlap: int


class JobParams(BaseModel):
    confidence_threshold: float = Field(0.50, ge=0.1, le=0.99)
    tile_size: int = Field(512, ge=128, le=2048)
    tile_overlap: int = Field(64, ge=0, le=512)
    min_polygon_area: float = Field(15.0, ge=1.0)
    simplify_tolerance: float = Field(0.8, ge=0.0, le=10.0)
    allow_demo_mode: bool = False


class JobResponse(BaseModel):
    id: str
    status: str
    original_filename: str
    file_size_bytes: int
    mime_type: Optional[str]
    width: Optional[int]
    height: Optional[int]
    is_georeferenced: bool
    crs_name: Optional[str]
    detected_buildings_count: int
    total_building_area: float
    area_unit: str
    mean_confidence: float
    confidence_threshold: float
    tile_size: int
    tile_overlap: int
    min_polygon_area: float
    simplify_tolerance: float
    processing_time_seconds: float
    image_url: Optional[str] = None
    mask_url: Optional[str] = None
    prob_map_url: Optional[str] = None
    geojson_url: Optional[str] = None
    csv_url: Optional[str] = None
    zip_export_url: Optional[str] = None
    report_url: Optional[str] = None
    error_message: Optional[str] = None
    warnings: List[str] = []
    is_demo_mode: bool
    created_at: str
    updated_at: str


class ProcessingReport(BaseModel):
    job_id: str
    status: str
    generated_at: str
    input_metadata: Dict[str, Any]
    model_information: Dict[str, Any]
    execution_parameters: Dict[str, Any]
    results_summary: Dict[str, Any]
    spatial_analysis: Dict[str, Any]
    warnings: List[str]
    artifact_paths: Dict[str, Optional[str]]
    legal_disclaimer: str
