"""
UrbanFootprint AI - Background Job Execution Service
Coordinates raster validation, georeferencing, AI segmentation,
polygon vectorization, spatial joins, and artifact generation.
"""

import os
import json
import time
import numpy as np
from PIL import Image
from typing import Dict, Any, Optional

from backend.app.core.config import settings
from backend.app.db.database import update_job_record, get_job_by_id
from backend.app.geospatial.georef import read_raster_metadata
from backend.app.geospatial.polygonizer import mask_to_building_polygons
from backend.app.geospatial.parcels import match_buildings_to_parcels, CAD_DISCLAIMER
from backend.app.geospatial.exporter import (
    generate_geojson,
    export_csv_attributes,
    create_export_package_zip,
)
from ml.inference import InferenceEngine

# Global singleton inference engine initialized with default checkpoint
_inference_engine: Optional[InferenceEngine] = None


def get_inference_engine() -> InferenceEngine:
    global _inference_engine
    if _inference_engine is None:
        _inference_engine = InferenceEngine(
            checkpoint_path=settings.default_checkpoint_path,
            device_preference=settings.device_preference,
            default_tile_size=settings.default_tile_size,
            default_overlap=settings.default_tile_overlap,
        )
    return _inference_engine


def reload_inference_engine(checkpoint_path: Optional[str] = None):
    global _inference_engine
    _inference_engine = InferenceEngine(
        checkpoint_path=checkpoint_path or settings.default_checkpoint_path,
        device_preference=settings.device_preference,
        default_tile_size=settings.default_tile_size,
        default_overlap=settings.default_tile_overlap,
    )


def execute_extraction_job(
    job_id: str,
    image_path: str,
    confidence_threshold: float,
    tile_size: int,
    tile_overlap: int,
    min_polygon_area: float,
    simplify_tolerance: float,
    allow_demo_mode: bool = False,
    parcel_geojson_data: Optional[Dict[str, Any]] = None,
):
    """
    Executes an extraction job synchronously inside a background worker thread.
    """
    start_time = time.time()
    warnings = []

    try:
        update_job_record(job_id, {"status": "processing"})

        # 1. Image Validation & Metadata
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Uploaded image not found: {image_path}")

        try:
            with Image.open(image_path) as img:
                img.verify()
            # Reopen after verify
            with Image.open(image_path) as img:
                rgb_img = img.convert("RGB")
                img_arr = np.array(rgb_img)
                w, h = img.size
        except Exception as e:
            raise ValueError(f"Corrupted or unsupported image file: {str(e)}")

        # 2. Geospatial Reference Parsing
        geo_meta = read_raster_metadata(image_path)
        if not geo_meta.is_georeferenced:
            warnings.append(
                "Notice: Image does not contain CRS or affine transform tags. Coordinates and areas are measured in pixels."
            )

        # 3. AI Semantic Segmentation
        engine = get_inference_engine()
        binary_mask, prob_map, infer_meta = engine.predict_image(
            image_np=img_arr,
            confidence_threshold=confidence_threshold,
            tile_size=tile_size,
            overlap=tile_overlap,
            allow_demo_mode=allow_demo_mode,
        )

        if infer_meta.get("warnings"):
            warnings.extend(infer_meta["warnings"])

        # 4. Building Polygon Extraction
        buildings, poly_summary = mask_to_building_polygons(
            binary_mask=binary_mask,
            probability_map=prob_map,
            geo_meta=geo_meta,
            min_area=min_polygon_area,
            simplify_tolerance=simplify_tolerance,
            min_confidence=confidence_threshold,
        )

        # 5. Optional Cadastral Spatial Join
        spatial_join_meta = None
        if parcel_geojson_data:
            match_res = match_buildings_to_parcels(
                buildings=buildings,
                parcel_geojson=parcel_geojson_data,
                use_geo=geo_meta.is_georeferenced,
            )
            buildings = match_res["buildings"]
            spatial_join_meta = match_res.get("spatial_join_summary")

        # 6. Save Artifacts
        base_name = f"{job_id}"
        processed_dir = settings.processed_dir
        mask_path = os.path.join(processed_dir, f"{base_name}_mask.png")
        prob_path = os.path.join(processed_dir, f"{base_name}_prob.png")
        geojson_path = os.path.join(processed_dir, f"{base_name}_buildings.geojson")
        csv_path = os.path.join(processed_dir, f"{base_name}_buildings.csv")
        report_path = os.path.join(processed_dir, f"{base_name}_report.json")

        # Save mask image
        Image.fromarray(binary_mask).save(mask_path, format="PNG")

        # Save probability map as 8-bit visualization
        prob_uint8 = (prob_map * 255).astype(np.uint8)
        Image.fromarray(prob_uint8).save(prob_path, format="PNG")

        # Generate GeoJSON
        geojson_data = generate_geojson(
            buildings=buildings,
            geo_meta=geo_meta,
            job_id=job_id,
            source_filename=os.path.basename(image_path),
        )
        with open(geojson_path, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, indent=2)

        # Save CSV attributes
        export_csv_attributes(buildings, csv_path)

        # Save Processing Report
        total_time = round(time.time() - start_time, 3)
        report_data = {
            "job_id": job_id,
            "status": "completed",
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "input_metadata": {
                "filename": os.path.basename(image_path),
                "width": w,
                "height": h,
                "is_georeferenced": geo_meta.is_georeferenced,
                "crs_name": geo_meta.crs_name,
                "crs_epsg": geo_meta.crs_epsg,
                "spatial_resolution": geo_meta.to_dict().get("pixel_resolution"),
                "units": geo_meta.units,
            },
            "model_information": {
                "architecture": "BuildingUNet-Res",
                "is_genuine_ai": infer_meta.get("is_genuine_ai", True),
                "mode": infer_meta.get("mode", "real_inference"),
                "device": infer_meta.get("device", "cpu"),
                "tiles_processed": infer_meta.get("tiles_processed", 0),
            },
            "execution_parameters": {
                "confidence_threshold": confidence_threshold,
                "tile_size": tile_size,
                "tile_overlap": tile_overlap,
                "min_polygon_area": min_polygon_area,
                "simplify_tolerance": simplify_tolerance,
                "total_processing_time_seconds": total_time,
            },
            "results_summary": {
                "detected_buildings_count": len(buildings),
                "total_building_area": poly_summary["total_area"],
                "area_unit": poly_summary["area_unit"],
                "mean_confidence": poly_summary.get("mean_confidence", 0.0),
            },
            "spatial_analysis": {
                "parcels_provided": bool(parcel_geojson_data),
                "spatial_join": spatial_join_meta,
            },
            "warnings": warnings,
            "artifact_paths": {
                "mask_png": mask_path,
                "probability_map_png": prob_path,
                "geojson": geojson_path,
                "csv": csv_path,
            },
            "legal_disclaimer": CAD_DISCLAIMER,
        }

        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)

        # Create ZIP archive
        zip_path = create_export_package_zip(
            job_id=job_id,
            output_dir=settings.output_dir,
            geojson_path=geojson_path,
            csv_path=csv_path,
            mask_png_path=mask_path,
            report_json_path=report_path,
        )

        # Update DB Record
        update_job_record(job_id, {
            "status": "completed",
            "width": w,
            "height": h,
            "is_georeferenced": 1 if geo_meta.is_georeferenced else 0,
            "crs_name": geo_meta.crs_name,
            "detected_buildings_count": len(buildings),
            "total_building_area": poly_summary["total_area"],
            "area_unit": poly_summary["area_unit"],
            "mean_confidence": poly_summary.get("mean_confidence", 0.0),
            "processing_time_seconds": total_time,
            "mask_path": mask_path,
            "prob_map_path": prob_path,
            "geojson_path": geojson_path,
            "csv_path": csv_path,
            "zip_export_path": zip_path,
            "report_path": report_path,
            "warnings": warnings,
            "is_demo_mode": 1 if infer_meta.get("mode") == "demo_synthetic" else 0,
        })

    except Exception as e:
        total_time = round(time.time() - start_time, 3)
        update_job_record(job_id, {
            "status": "failed",
            "error_message": str(e),
            "processing_time_seconds": total_time,
            "warnings": warnings + [f"Execution halted: {str(e)}"],
        })
