"""
UrbanFootprint AI - Cadastral Parcel Spatial Join
Performs spatial overlay analysis between extracted building footprints and user-supplied parcel boundaries.
Clearly states that automated extraction does NOT establish legal ownership.
"""

from typing import List, Dict, Any, Optional
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.validation import make_valid


CAD_DISCLAIMER = (
    "DISCLAIMER: Automated building footprint extraction and spatial joins are for geospatial "
    "analytical and planning assistance only. They do NOT establish legal cadastral ownership, "
    "boundary demarcation, or land-title rights."
)


def match_buildings_to_parcels(
    buildings: List[Dict[str, Any]],
    parcel_geojson: Dict[str, Any],
    use_geo: bool = True,
) -> Dict[str, Any]:
    """
    Performs spatial join between extracted building footprints and cadastral parcels.

    Parameters:
        buildings: List of building dictionaries containing geometry
        parcel_geojson: FeatureCollection or GeometryCollection of parcel polygons
        use_geo: If True, uses 'geo_geometry'; else uses 'pixel_geometry'

    Returns:
        Dictionary with updated buildings, parcel summary statistics, and legal disclaimer.
    """
    features = parcel_geojson.get("features", [])
    if not features and parcel_geojson.get("type") == "Feature":
        features = [parcel_geojson]

    parcels_parsed = []
    for f_idx, feat in enumerate(features):
        geom_dict = feat.get("geometry")
        props = feat.get("properties", {})
        if not geom_dict:
            continue
        try:
            poly = shape(geom_dict)
            if not poly.is_valid:
                poly = make_valid(poly)
            p_id = props.get("parcel_id", props.get("id", f"PARCEL-{f_idx+1:03d}"))
            parcels_parsed.append({
                "parcel_id": str(p_id),
                "geometry": poly,
                "properties": props,
                "area": float(poly.area),
                "buildings_inside": [],
                "buildings_intersecting": [],
            })
        except Exception:
            continue

    if not parcels_parsed:
        return {
            "buildings": buildings,
            "matched_parcels": [],
            "disclaimer": CAD_DISCLAIMER,
            "status": "No valid parcel polygons parsed from input",
        }

    inside_count = 0
    intersecting_count = 0
    outside_count = 0

    for bld in buildings:
        geom_key = "geo_geometry" if use_geo and bld.get("geo_geometry") else "pixel_geometry"
        geom_data = bld.get(geom_key)
        if not geom_data:
            outside_count += 1
            continue

        try:
            b_poly = shape(geom_data)
            if not b_poly.is_valid:
                b_poly = make_valid(b_poly)

            matched_parcel_id = None
            relation = "outside"

            for parcel in parcels_parsed:
                p_poly = parcel["geometry"]
                if p_poly.contains(b_poly):
                    relation = "inside"
                    matched_parcel_id = parcel["parcel_id"]
                    parcel["buildings_inside"].append(bld["id"])
                    inside_count += 1
                    break
                elif p_poly.intersects(b_poly):
                    relation = "intersecting"
                    matched_parcel_id = parcel["parcel_id"]
                    parcel["buildings_intersecting"].append(bld["id"])
                    intersecting_count += 1
                    break

            if relation == "outside":
                outside_count += 1

            bld["parcel_id"] = matched_parcel_id
            bld["parcel_relation"] = relation

        except Exception:
            outside_count += 1

    parcel_summaries = []
    for p in parcels_parsed:
        total_blds = len(p["buildings_inside"]) + len(p["buildings_intersecting"])
        parcel_summaries.append({
            "parcel_id": p["parcel_id"],
            "building_count": total_blds,
            "inside_building_ids": p["buildings_inside"],
            "intersecting_building_ids": p["buildings_intersecting"],
        })

    return {
        "buildings": buildings,
        "parcels": parcel_summaries,
        "spatial_join_summary": {
            "total_parcels": len(parcels_parsed),
            "buildings_inside": inside_count,
            "buildings_intersecting": intersecting_count,
            "buildings_outside": outside_count,
        },
        "disclaimer": CAD_DISCLAIMER,
    }
