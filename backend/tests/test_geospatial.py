"""
UrbanFootprint AI - Geospatial Engine Unit Tests
Tests mask-to-polygon conversion, noise filtering, georeferencing, parcel joins, and GeoJSON export.
"""

import numpy as np
import pytest
from shapely.geometry import Polygon

from backend.app.geospatial.georef import GeoRasterMetadata, read_raster_metadata
from backend.app.geospatial.polygonizer import mask_to_building_polygons
from backend.app.geospatial.parcels import match_buildings_to_parcels, CAD_DISCLAIMER
from backend.app.geospatial.exporter import generate_geojson


def test_mask_to_polygons_deterministic():
    """Verify that a synthetic mask generates expected building polygons with proper geometry"""
    mask = np.zeros((100, 100), dtype=np.uint8)
    # Draw two distinct building rectangles
    mask[10:30, 10:30] = 255  # 20x20 = 400 px area
    mask[50:80, 50:70] = 255  # 30x20 = 600 px area
    # Small noise component (should be filtered by min_area)
    mask[90:92, 90:92] = 255  # 2x2 = 4 px area

    prob_map = (mask.astype(np.float32) / 255.0) * 0.95

    buildings, summary = mask_to_building_polygons(
        binary_mask=mask,
        probability_map=prob_map,
        geo_meta=None,
        min_area=15.0,  # filters the 4px component
        simplify_tolerance=0.5,
        min_confidence=0.4,
    )

    assert len(buildings) == 2, f"Expected 2 buildings, got {len(buildings)}"
    assert summary["total_buildings"] == 2
    assert summary["area_unit"] == "pixels²"
    assert summary["is_georeferenced"] is False

    # Check building IDs
    assert buildings[0]["id"] == "BLD-0001"
    assert buildings[1]["id"] == "BLD-0002"
    assert buildings[0]["confidence"] > 0.8
    assert buildings[0]["pixel_area"] > 350


def test_georeferencing_units_and_crs():
    """Verify that unreferenced images are explicitly marked as local pixel coordinates"""
    unref = GeoRasterMetadata(width=500, height=500, is_georeferenced=False)
    assert unref.is_georeferenced is False
    assert "Non-Georeferenced" in unref.crs_name
    assert unref.units == "pixels"

    ref = GeoRasterMetadata(
        width=1000,
        height=1000,
        is_georeferenced=True,
        crs_epsg=32632,
        crs_name="WGS 84 / UTM zone 32N",
        transform=(0.3, 0.0, 500000.0, 0.0, -0.3, 5200000.0),
        pixel_size_x=0.3,
        pixel_size_y=0.3,
        units="meters",
    )
    assert ref.is_georeferenced is True
    assert ref.units == "meters"
    assert ref.crs_epsg == 32632


def test_geojson_export_structure():
    """Verify GeoJSON FeatureCollection generation meets GIS specifications"""
    mock_buildings = [
        {
            "id": "BLD-0001",
            "confidence": 0.92,
            "pixel_area": 400.0,
            "pixel_perimeter": 80.0,
            "area_m2": None,
            "perimeter_m": None,
            "pixel_geometry": {
                "type": "Polygon",
                "coordinates": [[[10, 10], [30, 10], [30, 30], [10, 30], [10, 10]]],
            },
            "geo_geometry": None,
            "parcel_id": "PARCEL-101",
            "parcel_relation": "inside",
        }
    ]

    geojson = generate_geojson(mock_buildings, geo_meta=None, job_id="test-job-123")
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 1
    feat = geojson["features"][0]
    assert feat["id"] == "BLD-0001"
    assert feat["properties"]["parcel_id"] == "PARCEL-101"
    assert feat["properties"]["area_unit"] == "pixels²"


def test_parcel_spatial_join():
    """Verify spatial overlay categorization (inside, intersecting, outside)"""
    mock_buildings = [
        {
            "id": "BLD-0001",
            "pixel_geometry": {
                "type": "Polygon",
                "coordinates": [[[15, 15], [25, 15], [25, 25], [15, 25], [15, 15]]],
            },
            "geo_geometry": None,
        },
        {
            "id": "BLD-0002",
            "pixel_geometry": {
                "type": "Polygon",
                "coordinates": [[[80, 80], [95, 80], [95, 95], [80, 95], [80, 80]]],
            },
            "geo_geometry": None,
        },
    ]

    # Parcel covering [10, 10] to [30, 30]
    parcel_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"parcel_id": "CAD-ZONE-A"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[10, 10], [30, 10], [30, 30], [10, 30], [10, 10]]],
                },
            }
        ],
    }

    join_res = match_buildings_to_parcels(mock_buildings, parcel_geojson, use_geo=False)
    assert join_res["disclaimer"] == CAD_DISCLAIMER
    summary = join_res["spatial_join_summary"]
    assert summary["buildings_inside"] == 1
    assert summary["buildings_outside"] == 1

    b1 = [b for b in join_res["buildings"] if b["id"] == "BLD-0001"][0]
    assert b1["parcel_id"] == "CAD-ZONE-A"
    assert b1["parcel_relation"] == "inside"
