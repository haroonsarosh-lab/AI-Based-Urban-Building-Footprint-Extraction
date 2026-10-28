"""
UrbanFootprint AI - Polygon Extraction & Vectorization Pipeline
Converts binary segmentation masks into topologically valid GIS polygons,
removes noise artifacts, simplifies boundaries, computes attributes, and assigns stable IDs.
"""

import cv2
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, shape, mapping
from shapely.validation import make_valid
from shapely.ops import transform as shapely_transform
from typing import List, Dict, Any, Optional, Tuple

from backend.app.geospatial.georef import GeoRasterMetadata, transform_shapely_to_wgs84


def mask_to_building_polygons(
    binary_mask: np.ndarray,
    probability_map: Optional[np.ndarray] = None,
    geo_meta: Optional[GeoRasterMetadata] = None,
    min_area: float = 15.0,
    simplify_tolerance: float = 0.8,
    min_confidence: float = 0.40,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Extracts individual vector polygons from a binary mask.

    Parameters:
        binary_mask: 2D uint8 array (255 = building, 0 = background)
        probability_map: 2D float32 array in [0.0, 1.0] for confidence scoring
        geo_meta: Raster georeferencing metadata
        min_area: Minimum area cutoff (in pixels or m^2 depending on metadata)
        simplify_tolerance: Douglas-Peucker simplification tolerance
        min_confidence: Minimum average building confidence required

    Returns:
        buildings: List of building feature dictionaries
        summary: Statistics on detected buildings, total footprint area, etc.
    """
    if binary_mask.ndim > 2:
        binary_mask = binary_mask.squeeze()

    # Ensure mask is uint8 {0, 255}
    if binary_mask.dtype != np.uint8:
        binary_mask = (binary_mask > 0).astype(np.uint8) * 255

    # Find 2-level hierarchy contours to handle buildings with interior courtyards/holes
    contours, hierarchy = cv2.findContours(
        binary_mask,
        cv2.RETR_CCOMP,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    if not contours or hierarchy is None:
        return [], {
            "total_buildings": 0,
            "total_area": 0.0,
            "area_unit": "m²" if (geo_meta and geo_meta.is_georeferenced and geo_meta.units == "meters") else "pixels²",
            "is_georeferenced": geo_meta.is_georeferenced if geo_meta else False,
        }

    hierarchy = hierarchy[0]
    extracted_polygons: List[Dict[str, Any]] = []
    building_counter = 1

    # First pass: iterate over parent contours (hierarchy[i][3] == -1 indicates outer boundary)
    for i, c in enumerate(contours):
        if hierarchy[i][3] != -1:
            continue  # Skip inner holes; they will be attached to their parent

        if len(c) < 3:
            continue

        raw_shell = c.reshape(-1, 2)
        if len(raw_shell) < 3:
            continue

        # Collect child contours (holes/courtyards)
        holes = []
        child_idx = hierarchy[i][2]
        while child_idx != -1:
            child_cnt = contours[child_idx]
            if len(child_cnt) >= 3:
                child_pts = child_cnt.reshape(-1, 2)
                if len(child_pts) >= 3:
                    holes.append(child_pts)
            child_idx = hierarchy[child_idx][0]

        try:
            poly = Polygon(shell=raw_shell, holes=holes)
            if not poly.is_valid:
                poly = make_valid(poly)

            # Extract list of polygons if result is MultiPolygon
            sub_polys = []
            if poly.geom_type == "Polygon":
                sub_polys = [poly]
            elif poly.geom_type == "MultiPolygon":
                sub_polys = [p for p in poly.geoms if p.geom_type == "Polygon"]
            else:
                continue

            for p in sub_polys:
                if p.is_empty:
                    continue

                # Simplification
                if simplify_tolerance > 0:
                    p = p.simplify(simplify_tolerance, preserve_topology=True)
                if not p.is_valid:
                    p = make_valid(p)
                if p.geom_type != "Polygon" or p.is_empty:
                    continue

                pixel_area = float(p.area)
                pixel_perimeter = float(p.length)

                if pixel_area < min_area:
                    continue

                # Compute mean confidence inside building polygon
                building_conf = 1.0
                if probability_map is not None:
                    # Create bounding box slice for fast confidence sampling
                    minx, miny, maxx, maxy = [int(v) for v in p.bounds]
                    minx, miny = max(0, minx), max(0, miny)
                    maxx = min(probability_map.shape[1], maxx + 1)
                    maxy = min(probability_map.shape[0], maxy + 1)

                    if maxx > minx and maxy > miny:
                        sub_prob = probability_map[miny:maxy, minx:maxx]
                        # Sub-mask for polygon
                        sub_mask = np.zeros(sub_prob.shape, dtype=np.uint8)
                        shifted_shell = (np.array(p.exterior.coords) - [minx, miny]).astype(np.int32)
                        shifted_holes = [
                            (np.array(h.coords) - [minx, miny]).astype(np.int32)
                            for h in p.interiors
                        ]
                        cv2.fillPoly(sub_mask, [shifted_shell], 1)
                        if shifted_holes:
                            cv2.fillPoly(sub_mask, shifted_holes, 0)

                        if np.sum(sub_mask) > 0:
                            building_conf = float(np.mean(sub_prob[sub_mask == 1]))
                        else:
                            building_conf = float(np.mean(sub_prob))

                if building_conf < min_confidence:
                    continue

                # Compute real-world measurements if georeferenced
                bld_id = f"BLD-{building_counter:04d}"
                building_counter += 1

                centroid_px = (float(p.centroid.x), float(p.centroid.y))
                pixel_coords = {
                    "type": "Polygon",
                    "coordinates": [
                        [[round(x, 2), round(y, 2)] for x, y in p.exterior.coords]
                    ] + [
                        [[round(x, 2), round(y, 2)] for x, y in h.coords]
                        for h in p.interiors
                    ],
                }

                # Geospatial coordinate transformation
                geo_coords = None
                geo_centroid = None
                area_m2 = None
                perimeter_m = None

                if geo_meta and geo_meta.is_georeferenced and geo_meta.transform:
                    geom_geo, target_epsg = transform_shapely_to_wgs84(
                        p,
                        source_epsg=geo_meta.crs_epsg,
                        transform=geo_meta.transform,
                    )
                    geo_coords = mapping(geom_geo)
                    geo_centroid = {
                        "lon": round(geom_geo.centroid.x, 6),
                        "lat": round(geom_geo.centroid.y, 6),
                    }

                    # Physical area in square meters
                    if geo_meta.pixel_size_x and geo_meta.pixel_size_y and geo_meta.units == "meters":
                        area_m2 = round(pixel_area * abs(geo_meta.pixel_size_x * geo_meta.pixel_size_y), 2)
                        perimeter_m = round(pixel_perimeter * abs(geo_meta.pixel_size_x), 2)
                    elif geo_meta.crs_epsg:
                        # Attempt projected measurement
                        area_m2 = round(pixel_area * (abs(geo_meta.pixel_size_x or 0.3) ** 2), 2)
                        perimeter_m = round(pixel_perimeter * abs(geo_meta.pixel_size_x or 0.3), 2)

                extracted_polygons.append({
                    "id": bld_id,
                    "pixel_area": round(pixel_area, 1),
                    "pixel_perimeter": round(pixel_perimeter, 1),
                    "area_m2": area_m2,
                    "perimeter_m": perimeter_m,
                    "confidence": round(building_conf, 3),
                    "centroid_pixel": {"x": round(centroid_px[0], 1), "y": round(centroid_px[1], 1)},
                    "centroid_geo": geo_centroid,
                    "bounds_pixel": [round(b, 1) for b in p.bounds],
                    "pixel_geometry": pixel_coords,
                    "geo_geometry": geo_coords,
                    "parcel_id": None,
                    "parcel_relation": "none",
                })

        except Exception:
            continue

    is_geo = bool(geo_meta and geo_meta.is_georeferenced)
    total_area = sum(b["area_m2"] if (is_geo and b["area_m2"]) else b["pixel_area"] for b in extracted_polygons)

    summary = {
        "total_buildings": len(extracted_polygons),
        "total_area": round(total_area, 2),
        "area_unit": "m²" if (is_geo and any(b["area_m2"] for b in extracted_polygons)) else "pixels²",
        "is_georeferenced": is_geo,
        "mean_confidence": round(float(np.mean([b["confidence"] for b in extracted_polygons])), 3) if extracted_polygons else 0.0,
    }

    return extracted_polygons, summary
