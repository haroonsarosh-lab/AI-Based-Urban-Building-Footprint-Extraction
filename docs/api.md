# REST API Specification — UrbanFootprint AI

The backend exposes a REST API compliant with OpenAPI 3.0. Interactive documentation is accessible at `http://127.0.0.1:8000/api/docs`.

---

## Endpoints Summary

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health status of server and loaded model | `200 OK` |
| `GET` | `/api/model/info` | Architecture, checkpoint metadata & device | `200 OK` |
| `GET` | `/api/stats` | Dashboard statistics (total jobs, buildings) | `200 OK` |
| `GET` | `/api/jobs` | List recent extraction jobs | `200 OK` |
| `GET` | `/api/jobs/{id}` | Get status and artifact URLs for a job | `200 OK` |
| `POST` | `/api/jobs` | Submit imagery for footprint extraction | `202 Accepted` |
| `POST` | `/api/jobs/{id}/retry` | Re-run a failed or existing job | `200 OK` |
| `GET` | `/api/jobs/{id}/report` | Retrieve complete JSON audit report | `200 OK` |
| `GET` | `/api/jobs/{id}/download/{artifact}` | Download GIS vector or raster outputs | `200 OK` |

---

## 1. `GET /api/health`
Returns system heartbeat and database connectivity.

**Response (200 OK):**
```json
{
  "status": "ok",
  "app_name": "UrbanFootprint AI",
  "version": "1.0.0",
  "timestamp": "2026-10-28T11:00:00Z",
  "database_connected": true,
  "model_loaded": true
}
```

---

## 2. `GET /api/model/info`
Reports model architecture, checkpoint path, device, and validation metrics.

**Response (200 OK):**
```json
{
  "model_architecture": "BuildingUNet-Res (Lightweight Res-UNet)",
  "model_loaded": true,
  "checkpoint_path": "./data/checkpoints/urban_unet_best.pt",
  "is_synthetic_checkpoint": true,
  "device": "cpu",
  "cuda_available": false,
  "load_error": null,
  "checkpoint_metadata": {
    "epoch": 3,
    "val_iou": 0.6951,
    "val_dice": 0.8201
  },
  "default_tile_size": 512,
  "default_overlap": 64
}
```

---

## 3. `POST /api/jobs`
Accepts `multipart/form-data`:
- `image` *(Required)*: Raster image file (`.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.geotiff`).
- `parcels` *(Optional)*: Cadastral parcel GeoJSON file (`.geojson`, `.json`).
- `confidence_threshold` *(Float, default 0.50)*: Cutoff probability for building classification.
- `tile_size` *(Integer, default 512)*: Patch sliding window dimension.
- `tile_overlap` *(Integer, default 64)*: Overlap in pixels between adjacent tiles.
- `min_polygon_area` *(Float, default 15.0)*: Minimum area filter (pixels or m²).
- `simplify_tolerance` *(Float, default 0.8)*: Douglas-Peucker simplification tolerance.
- `allow_demo_mode` *(Boolean, default false)*: Allows synthetic fallback if weights are absent.

**Response (202 Accepted):**
```json
{
  "id": "uf-9a8b7c6d5e",
  "status": "pending",
  "original_filename": "satellite_scene.tif",
  "file_size_bytes": 1420580,
  "detected_buildings_count": 0,
  "is_georeferenced": false,
  "image_url": "/api/jobs/uf-9a8b7c6d5e/download/image",
  "created_at": "2026-10-28T11:02:00Z"
}
```

---

## 4. `GET /api/jobs/{job_id}/download/{artifact}`
Downloads result files where `{artifact}` is one of:
- `geojson`: GIS-ready GeoJSON polygon FeatureCollection.
- `csv`: Building attributes table (ID, Area, Perimeter, Confidence, Parcel ID, Spatial Relation).
- `zip`: Structured GIS export bundle containing GeoJSON, CSV, Mask PNG, and Processing Report JSON.
- `mask`: 8-bit binary building footprint mask PNG.
- `prob`: Grayscale normalized probability map PNG.
- `report`: Comprehensive audit report JSON.
- `image`: Original uploaded source image.
