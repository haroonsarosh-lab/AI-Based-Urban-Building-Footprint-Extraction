"""
UrbanFootprint AI - Georeferencing & Coordinate Reference System Engine
Handles GeoTIFF metadata parsing (affine transform, CRS, bounds, resolution),
coordinate transformations, and prevents false coordinate claims for non-georeferenced images.
"""

import os
from typing import Dict, Any, Optional, Tuple, List
import numpy as np
from PIL import Image
import tifffile
from pyproj import CRS, Transformer
from shapely.geometry import Polygon, MultiPolygon, shape, mapping
from shapely.ops import transform as shapely_transform


class GeoRasterMetadata:
    """
    Encapsulates raster spatial reference and affine transformation.
    Affine matrix:
      X_geo = a * x + b * y + c
      Y_geo = d * x + e * y + f
    """

    def __init__(
        self,
        width: int,
        height: int,
        is_georeferenced: bool = False,
        crs_epsg: Optional[int] = None,
        crs_wkt: Optional[str] = None,
        crs_name: Optional[str] = None,
        transform: Optional[Tuple[float, float, float, float, float, float]] = None,
        bounds: Optional[Dict[str, float]] = None,
        pixel_size_x: Optional[float] = None,
        pixel_size_y: Optional[float] = None,
        units: str = "pixels",
    ):
        self.width = width
        self.height = height
        self.is_georeferenced = is_georeferenced
        self.crs_epsg = crs_epsg
        self.crs_wkt = crs_wkt
        self.crs_name = crs_name or (f"EPSG:{crs_epsg}" if crs_epsg else "Local Pixel Coordinates (Non-Georeferenced)")
        # (a, b, c, d, e, f) where c = origin_x, f = origin_y
        self.transform = transform
        self.bounds = bounds
        self.pixel_size_x = pixel_size_x
        self.pixel_size_y = pixel_size_y
        self.units = units

    def to_dict(self) -> Dict[str, Any]:
        return {
            "width": self.width,
            "height": self.height,
            "is_georeferenced": self.is_georeferenced,
            "crs_epsg": self.crs_epsg,
            "crs_name": self.crs_name,
            "transform": list(self.transform) if self.transform else None,
            "bounds": self.bounds,
            "pixel_resolution": {
                "x": round(self.pixel_size_x, 6) if self.pixel_size_x else None,
                "y": round(self.pixel_size_y, 6) if self.pixel_size_y else None,
            },
            "units": self.units,
            "spatial_explanation": (
                f"Georeferenced in {self.crs_name} with ground resolution of ~{abs(self.pixel_size_x or 0):.2f}m/px."
                if self.is_georeferenced
                else "Image contains no embedded CRS or geographic transform. Coordinates and polygon measurements are in pixel units."
            ),
        }

    def pixel_to_geo(self, px: float, py: float) -> Tuple[float, float]:
        """Convert pixel (x, y) to geographic coordinate (X, Y)"""
        if not self.is_georeferenced or not self.transform:
            return px, py
        a, b, c, d, e, f = self.transform
        geo_x = a * px + b * py + c
        geo_y = d * px + e * py + f
        return geo_x, geo_y


def read_raster_metadata(file_path: str) -> GeoRasterMetadata:
    """
    Reads an image or GeoTIFF and extracts metadata, affine transformation, and CRS.
    """
    ext = os.path.splitext(file_path)[1].lower()

    # Default image reading via PIL for width/height
    with Image.open(file_path) as img:
        width, height = img.size

    # Only TIFF/GeoTIFF files can carry geospatial tags
    if ext not in [".tif", ".tiff", ".geotiff"]:
        return GeoRasterMetadata(
            width=width,
            height=height,
            is_georeferenced=False,
            units="pixels",
        )

    try:
        with tifffile.TiffFile(file_path) as tif:
            page = tif.pages[0]
            tags = page.tags

            # GeoTIFF ModelTiepointTag (33922) and ModelPixelScaleTag (33550)
            tiepoint = tags.get(33922)
            pixel_scale = tags.get(33550)
            model_transform = tags.get(34264)  # ModelTransformationTag 4x4 matrix
            geo_keys = tags.get(34735)  # GeoKeyDirectoryTag

            if model_transform:
                m = model_transform.value
                # 4x4 matrix: [a, b, 0, c,  d, e, 0, f, ...]
                a, b, c = float(m[0]), float(m[1]), float(m[3])
                d, e, f = float(m[4]), float(m[5]), float(m[7])
                transform = (a, b, c, d, e, f)
                scale_x, scale_y = abs(a), abs(e)
            elif tiepoint and pixel_scale:
                # tiepoint format: [i, j, k, x, y, z] (usually [0, 0, 0, origin_x, origin_y, 0])
                tp = tiepoint.value
                ps = pixel_scale.value
                origin_x = float(tp[3])
                origin_y = float(tp[4])
                scale_x = float(ps[0])
                scale_y = float(ps[1])
                # In standard raster georeferencing, y decreases downwards: e = -scale_y
                transform = (scale_x, 0.0, origin_x, 0.0, -scale_y, origin_y)
            else:
                return GeoRasterMetadata(width=width, height=height, is_georeferenced=False)

            # Determine EPSG if available from GeoKeys
            epsg_code = None
            crs_name = None
            if geo_keys:
                gk = geo_keys.value
                # GeoKeyDirectory format: [KeyDirectoryVersion, KeyRevision, MinorRevision, NumberOfKeys, KeyId, ...]
                for i in range(4, len(gk), 4):
                    key_id = gk[i]
                    val = gk[i + 3]
                    # ProjectedCSTypeGeoKey = 3072, GeographicTypeGeoKey = 2048
                    if key_id in (3072, 2048) and val > 0:
                        epsg_code = int(val)
                        break

            # Try to resolve CRS via pyproj
            crs_wkt = None
            if epsg_code:
                try:
                    c = CRS.from_epsg(epsg_code)
                    crs_name = c.name
                    crs_wkt = c.to_wkt()
                except Exception:
                    crs_name = f"EPSG:{epsg_code}"
            else:
                # Default to common web Mercator or UTM fallback if projection exists
                crs_name = "Projected CRS (Embedded Geokey)"

            # Compute geographic bounds
            a, b, c, d, e, f = transform
            min_x = c
            max_y = f
            max_x = a * width + b * height + c
            min_y = d * width + e * height + f

            # Ensure bounds min < max
            bounds = {
                "min_x": round(min(min_x, max_x), 6),
                "min_y": round(min(min_y, max_y), 6),
                "max_x": round(max(min_x, max_x), 6),
                "max_y": round(max(min_y, max_y), 6),
            }

            return GeoRasterMetadata(
                width=width,
                height=height,
                is_georeferenced=True,
                crs_epsg=epsg_code,
                crs_wkt=crs_wkt,
                crs_name=crs_name,
                transform=transform,
                bounds=bounds,
                pixel_size_x=scale_x,
                pixel_size_y=scale_y,
                units="meters" if epsg_code and epsg_code != 4326 else "degrees",
            )
    except Exception:
        # Fallback to unreferenced
        return GeoRasterMetadata(width=width, height=height, is_georeferenced=False)


def transform_shapely_to_wgs84(
    geom,
    source_epsg: Optional[int],
    transform: Optional[Tuple[float, float, float, float, float, float]],
):
    """
    Transforms a pixel-coordinate geometry to WGS84 (EPSG:4326) if georeferenced,
    or returns as pixel coordinates.
    """
    if not transform:
        return geom, None

    a, b, c, d, e, f = transform

    def pixel_to_src(x, y):
        geo_x = a * x + b * y + c
        geo_y = d * x + e * y + f
        return geo_x, geo_y

    geom_src = shapely_transform(pixel_to_src, geom)

    if source_epsg and source_epsg != 4326:
        try:
            trans = Transformer.from_crs(source_epsg, 4326, always_xy=True)
            geom_wgs84 = shapely_transform(trans.transform, geom_src)
            return geom_wgs84, 4326
        except Exception:
            return geom_src, source_epsg

    return geom_src, (source_epsg or 4326)
