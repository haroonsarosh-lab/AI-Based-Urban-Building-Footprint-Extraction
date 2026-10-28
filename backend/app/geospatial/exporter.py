"""
UrbanFootprint AI - GIS Vector Export Engine
Exports building footprints to GeoJSON, CSV attributes, and comprehensive ZIP packages.
"""

import os
import json
import csv
import zipfile
import time
from typing import List, Dict, Any, Optional

from backend.app.geospatial.georef import GeoRasterMetadata


def generate_geojson(
    buildings: List[Dict[str, Any]],
    geo_meta: Optional[GeoRasterMetadata] = None,
    job_id: str = "job",
    source_filename: str = "",
) -> Dict[str, Any]:
    """
    Constructs a GIS-compliant GeoJSON FeatureCollection from extracted building polygons.
    """
    is_geo = bool(geo_meta and geo_meta.is_georeferenced)
    features = []

    for b in buildings:
        # Use geographic coordinates if available, otherwise pixel coordinates
        geom = b.get("geo_geometry") if is_geo else b.get("pixel_geometry")
        if not geom:
            continue

        props = {
            "id": b["id"],
            "confidence": b.get("confidence", 1.0),
            "area": b.get("area_m2") if (is_geo and b.get("area_m2")) else b.get("pixel_area"),
            "area_unit": "m²" if (is_geo and b.get("area_m2")) else "pixels²",
            "perimeter": b.get("perimeter_m") if (is_geo and b.get("perimeter_m")) else b.get("pixel_perimeter"),
            "perimeter_unit": "meters" if (is_geo and b.get("perimeter_m")) else "pixels",
            "parcel_id": b.get("parcel_id"),
            "parcel_relation": b.get("parcel_relation", "none"),
            "is_georeferenced": is_geo,
            "source_image": source_filename,
            "job_id": job_id,
            "extracted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        features.append({
            "type": "Feature",
            "id": b["id"],
            "geometry": geom,
            "properties": props,
        })

    geojson_dict = {
        "type": "FeatureCollection",
        "name": f"UrbanFootprint_{job_id}",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84" if is_geo else "urn:ogc:def:crs:OGC:1.3:CRS_PIXEL_LOCAL"
            },
        },
        "features": features,
    }

    return geojson_dict


def export_csv_attributes(buildings: List[Dict[str, Any]], output_csv_path: str):
    """Exports tabular building attributes to CSV"""
    fieldnames = [
        "id",
        "confidence",
        "pixel_area",
        "pixel_perimeter",
        "area_m2",
        "perimeter_m",
        "parcel_id",
        "parcel_relation",
        "centroid_x",
        "centroid_y",
    ]

    with open(output_csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for b in buildings:
            geo_c = b.get("centroid_geo") or {}
            pix_c = b.get("centroid_pixel") or {}
            cx = geo_c.get("lon") or pix_c.get("x")
            cy = geo_c.get("lat") or pix_c.get("y")
            writer.writerow({
                "id": b.get("id"),
                "confidence": b.get("confidence"),
                "pixel_area": b.get("pixel_area"),
                "pixel_perimeter": b.get("pixel_perimeter"),
                "area_m2": b.get("area_m2"),
                "perimeter_m": b.get("perimeter_m"),
                "parcel_id": b.get("parcel_id"),
                "parcel_relation": b.get("parcel_relation"),
                "centroid_x": cx,
                "centroid_y": cy,
            })


def create_export_package_zip(
    job_id: str,
    output_dir: str,
    geojson_path: str,
    csv_path: Optional[str] = None,
    mask_png_path: Optional[str] = None,
    report_json_path: Optional[str] = None,
) -> str:
    """
    Packages all job artifacts into a distributable GIS ZIP archive.
    """
    os.makedirs(output_dir, exist_ok=True)
    zip_path = os.path.join(output_dir, f"urbanfootprint_{job_id}_export.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        if geojson_path and os.path.exists(geojson_path):
            zf.write(geojson_path, arcname=os.path.basename(geojson_path))
        if csv_path and os.path.exists(csv_path):
            zf.write(csv_path, arcname=os.path.basename(csv_path))
        if mask_png_path and os.path.exists(mask_png_path):
            zf.write(mask_png_path, arcname=os.path.basename(mask_png_path))
        if report_json_path and os.path.exists(report_json_path):
            zf.write(report_json_path, arcname=os.path.basename(report_json_path))

    return zip_path
