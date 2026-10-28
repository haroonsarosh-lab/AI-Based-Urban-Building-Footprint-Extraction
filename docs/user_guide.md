# UrbanFootprint AI — User & Operator Guide

A complete walkthrough for geospatial analysts, urban planners, and GIS operators using **UrbanFootprint AI**.

---

## 1. Quick Start Workflow

### Step 1: Launch the Application
- Run `run.bat` on Windows, or start:
  - Backend: `.venv\Scripts\python.exe -m uvicorn backend.app.main:app --port 8000`
  - Frontend: `cd frontend && npm run dev`
- Open your browser at `http://localhost:3000`.

### Step 2: Upload Imagery
1. Navigate to **New Extraction** in the left sidebar.
2. Drag and drop your aerial image (GeoTIFF, TIFF, PNG, or JPEG).
   *(You can also click **"Load Sample Aerial Patch (512x512)"** for an immediate test).*
3. *(Optional)*: Upload a cadastral parcel boundary GeoJSON file to test spatial overlaps.

### Step 3: Configure Parameters
- **Confidence Threshold**: Set between 0.40 and 0.60 (default 0.50). Higher values reduce false positives.
- **Minimum Building Area**: Filter small structures and vegetation noise (default 15 sq units).
- **Patch Tiling Size**: Choose 512×512 for standard satellite rasters.
- **Simplify Tolerance**: 0.8 Douglas-Peucker tolerance for clean vector edges.

### Step 4: Execute Extraction
- Click **"Start Extraction Job"**.
- The system automatically transitions to the **GIS Workspace**, monitoring background AI segmentation, polygonization, and spatial joins in real-time.

---

## 2. Using the GIS Workspace

### Layer Controls
- **Satellite Image**: Toggles base raster visibility.
- **Building Mask**: Toggles translucent teal binary mask overlay.
- **Vector Polygons**: Renders crisp vector outlines around each building.
- **Prob Heatmap**: Displays continuous AI confidence probability gradients.
- **Opacity Slider**: Controls overlay transparency from 10% to 100%.

### Canvas Navigation
- **Click & Drag**: Pan across large aerial imagery.
- **Zoom In / Zoom Out**: Magnifies individual buildings down to pixel level.
- **Click on Building**: Selects the building polygon, highlighting it in amber on both the canvas and the attributes table.

### Building Attributes Table
- Search by Building ID (e.g. `BLD-0004`).
- Inspect Area (in $m^2$ for GeoTIFFs, or $\text{pixels}^2$ for non-georeferenced images).
- View Perimeter and AI Confidence percentage.
- Inspect Cadastral Parcel ID and spatial relation (`inside`, `intersecting`, `outside`).

---

## 3. Exporting GIS Artifacts

Download options available in the workspace:
1. **GeoJSON**: Standard GIS vector layer with complete attributes and CRS definition, compatible with QGIS and ArcGIS.
2. **CSV Attributes**: Tabular summary of all extracted buildings, area, perimeter, centroids, and parcel relations.
3. **Full GIS Package (.zip)**: All outputs (GeoJSON + CSV + Mask PNG + Audit Report) in a single archive.
4. **Audit Report JSON**: Complete parameter log, CRS details, execution duration, and legal disclaimers.
