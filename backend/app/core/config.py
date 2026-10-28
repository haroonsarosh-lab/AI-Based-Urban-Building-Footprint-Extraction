"""
UrbanFootprint AI - Application Configuration
"""

import os
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_name: str = "UrbanFootprint AI"
    app_subtitle: str = "AI-Powered Building Footprint Extraction & Geospatial Mapping"
    app_version: str = "1.0.0"
    debug: bool = True

    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"

    # Storage paths
    upload_dir: str = "./data/uploads"
    processed_dir: str = "./data/processed"
    checkpoint_dir: str = "./data/checkpoints"
    dataset_dir: str = "./data/datasets"
    output_dir: str = "./outputs"
    db_path: str = "./backend/urbanfootprint.db"

    # Model defaults
    default_checkpoint_path: str = "./data/checkpoints/urban_unet_best.pt"
    default_tile_size: int = 512
    default_tile_overlap: int = 64
    default_confidence_threshold: float = 0.50
    default_min_polygon_area: float = 15.0
    default_simplify_tolerance: float = 0.8
    device_preference: str = "cpu"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
for path in [
    settings.upload_dir,
    settings.processed_dir,
    settings.checkpoint_dir,
    settings.dataset_dir,
    settings.output_dir,
    os.path.dirname(settings.db_path),
]:
    os.makedirs(path, exist_ok=True)
