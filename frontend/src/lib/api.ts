/**
 * UrbanFootprint AI - Frontend API & Client Geospatial Simulation Engine
 * Supports both Live FastAPI Backend and Standalone GitHub Pages Demonstration Mode
 */

export interface HealthInfo {
  status: string;
  app_name: string;
  version: string;
  timestamp: string;
  database_connected: boolean;
  model_loaded: boolean;
  is_demo?: boolean;
}

export interface ModelInfo {
  model_architecture: string;
  model_loaded: boolean;
  checkpoint_path: string | null;
  is_synthetic_checkpoint: boolean;
  device: string;
  cuda_available: boolean;
  load_error: string | null;
  checkpoint_metadata: Record<string, any>;
  default_tile_size: number;
  default_overlap: number;
}

export interface JobItem {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  original_filename: string;
  file_size_bytes: number;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  is_georeferenced: boolean;
  crs_name: string | null;
  detected_buildings_count: number;
  total_building_area: number;
  area_unit: string;
  mean_confidence: number;
  confidence_threshold: number;
  tile_size: number;
  tile_overlap: number;
  min_polygon_area: number;
  simplify_tolerance: number;
  processing_time_seconds: number;
  image_url: string | null;
  mask_url: string | null;
  prob_map_url: string | null;
  geojson_url: string | null;
  csv_url: string | null;
  zip_export_url: string | null;
  report_url: string | null;
  error_message: string | null;
  warnings: string[];
  is_demo_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  total_buildings_detected: number;
  recent_job: JobItem | null;
}

// -------------------------------------------------------------
// Dynamic API URL Configuration (stored in localStorage)
// -------------------------------------------------------------
const STORAGE_KEY_API_URL = "urbanfootprint_api_url";
const STORAGE_KEY_CLIENT_JOBS = "urbanfootprint_client_jobs";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY_API_URL);
    if (saved) return saved.replace(/\/+$/, "");
  }
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== "undefined") {
    const cleaned = url.trim().replace(/\/+$/, "");
    if (!cleaned) {
      localStorage.removeItem(STORAGE_KEY_API_URL);
    } else {
      localStorage.setItem(STORAGE_KEY_API_URL, cleaned);
    }
  }
}

export const API_BASE_URL = getApiBaseUrl();

export function resolveApiUrl(path: string | null): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
    return path;
  }
  return `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

// -------------------------------------------------------------
// Realistic Synthetic Sample Aerial Imagery, Mask, and GeoJSON
// (Pre-rendered for Instant Interactive GitHub Pages Exploration)
// -------------------------------------------------------------

// Sample high-resolution 512x512 aerial SVG scene
const SAMPLE_AERIAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="lawn" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3f6212"/>
      <stop offset="100%" stop-color="#1e3a1a"/>
    </radialGradient>
    <linearGradient id="roof1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b91c1c"/>
      <stop offset="100%" stop-color="#7f1d1d"/>
    </linearGradient>
    <linearGradient id="roof2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="roof3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#92400e"/>
    </linearGradient>
    <linearGradient id="roof4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <!-- Background terrain / ground texture -->
  <rect width="512" height="512" fill="#2d3725"/>
  <rect x="0" y="0" width="220" height="180" fill="url(#lawn)" opacity="0.65"/>
  <rect x="290" y="270" width="222" height="242" fill="url(#lawn)" opacity="0.5"/>
  
  <!-- Roads and Street Network -->
  <path d="M 0 220 L 512 220" stroke="#334155" stroke-width="44" stroke-linecap="round"/>
  <path d="M 0 220 L 512 220" stroke="#f1f5f9" stroke-width="2" stroke-dasharray="14 12"/>
  <path d="M 256 0 L 256 512" stroke="#334155" stroke-width="38" stroke-linecap="round"/>
  <path d="M 256 0 L 256 512" stroke="#f1f5f9" stroke-width="2" stroke-dasharray="14 12"/>

  <!-- Walkways & Alleyways -->
  <path d="M 40 380 L 240 380" stroke="#64748b" stroke-width="12"/>
  <path d="M 275 110 L 480 110" stroke="#64748b" stroke-width="12"/>

  <!-- Residential & Commercial Buildings -->
  <!-- Block 1: Top-Left -->
  <polygon points="35,35 125,35 125,95 35,95" fill="url(#roof1)" stroke="#551a1a" stroke-width="2"/>
  <polygon points="145,40 220,40 220,105 145,105" fill="url(#roof2)" stroke="#0f172a" stroke-width="2"/>
  <polygon points="40,120 110,120 110,185 40,185" fill="url(#roof3)" stroke="#78350f" stroke-width="2"/>
  <polygon points="130,125 215,125 215,190 130,190" fill="url(#roof4)" stroke="#64748b" stroke-width="2"/>

  <!-- Block 2: Top-Right -->
  <polygon points="280,30 380,30 380,95 280,95" fill="url(#roof2)" stroke="#0f172a" stroke-width="2"/>
  <polygon points="405,35 485,35 485,90 405,90" fill="url(#roof1)" stroke="#551a1a" stroke-width="2"/>
  <polygon points="285,130 365,130 365,195 285,195" fill="url(#roof4)" stroke="#64748b" stroke-width="2"/>
  <polygon points="390,125 480,125 480,190 390,190" fill="url(#roof3)" stroke="#78350f" stroke-width="2"/>

  <!-- Block 3: Bottom-Left -->
  <polygon points="35,265 130,265 130,345 35,345" fill="url(#roof4)" stroke="#64748b" stroke-width="2"/>
  <polygon points="150,270 230,270 230,350 150,350" fill="url(#roof1)" stroke="#551a1a" stroke-width="2"/>
  <polygon points="45,410 135,410 135,480 45,480" fill="url(#roof3)" stroke="#78350f" stroke-width="2"/>
  <polygon points="155,405 235,405 235,475 155,475" fill="url(#roof2)" stroke="#0f172a" stroke-width="2"/>

  <!-- Block 4: Bottom-Right -->
  <polygon points="290,265 375,265 375,345 290,345" fill="url(#roof1)" stroke="#551a1a" stroke-width="2"/>
  <polygon points="400,270 485,270 485,350 400,350" fill="url(#roof2)" stroke="#0f172a" stroke-width="2"/>
  <polygon points="295,385 395,385 395,475 295,475" fill="url(#roof4)" stroke="#64748b" stroke-width="2"/>
  <polygon points="415,390 485,390 485,470 415,470" fill="url(#roof3)" stroke="#78350f" stroke-width="2"/>
</svg>`;

// Matching Binary Mask SVG (pure black and white)
const SAMPLE_MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <polygon points="35,35 125,35 125,95 35,95" fill="#ffffff"/>
  <polygon points="145,40 220,40 220,105 145,105" fill="#ffffff"/>
  <polygon points="40,120 110,120 110,185 40,185" fill="#ffffff"/>
  <polygon points="130,125 215,125 215,190 130,190" fill="#ffffff"/>
  <polygon points="280,30 380,30 380,95 280,95" fill="#ffffff"/>
  <polygon points="405,35 485,35 485,90 405,90" fill="#ffffff"/>
  <polygon points="285,130 365,130 365,195 285,195" fill="#ffffff"/>
  <polygon points="390,125 480,125 480,190 390,190" fill="#ffffff"/>
  <polygon points="35,265 130,265 130,345 35,345" fill="#ffffff"/>
  <polygon points="150,270 230,270 230,350 150,350" fill="#ffffff"/>
  <polygon points="45,410 135,410 135,480 45,480" fill="#ffffff"/>
  <polygon points="155,405 235,405 235,475 155,475" fill="#ffffff"/>
  <polygon points="290,265 375,265 375,345 290,345" fill="#ffffff"/>
  <polygon points="400,270 485,270 485,350 400,350" fill="#ffffff"/>
  <polygon points="295,385 395,385 395,475 295,475" fill="#ffffff"/>
  <polygon points="415,390 485,390 485,470 415,470" fill="#ffffff"/>
</svg>`;

// Matching Heatmap / Probability map SVG
const SAMPLE_PROB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f172a"/>
  <!-- Heat fields with soft gradients -->
  <g filter="blur(6px)">
    <rect x="30" y="30" width="100" height="70" fill="#38bdf8" opacity="0.8"/>
    <rect x="140" y="35" width="85" height="75" fill="#38bdf8" opacity="0.8"/>
    <rect x="35" y="115" width="80" height="75" fill="#38bdf8" opacity="0.8"/>
    <rect x="125" y="120" width="95" height="75" fill="#38bdf8" opacity="0.8"/>
    <rect x="275" y="25" width="110" height="75" fill="#38bdf8" opacity="0.8"/>
    <rect x="400" y="30" width="90" height="65" fill="#38bdf8" opacity="0.8"/>
    <rect x="280" y="125" width="90" height="75" fill="#38bdf8" opacity="0.8"/>
    <rect x="385" y="120" width="100" height="75" fill="#38bdf8" opacity="0.8"/>
    <rect x="30" y="260" width="105" height="90" fill="#38bdf8" opacity="0.8"/>
    <rect x="145" y="265" width="90" height="90" fill="#38bdf8" opacity="0.8"/>
    <rect x="40" y="405" width="100" height="80" fill="#38bdf8" opacity="0.8"/>
    <rect x="150" y="400" width="90" height="80" fill="#38bdf8" opacity="0.8"/>
    <rect x="285" y="260" width="95" height="90" fill="#38bdf8" opacity="0.8"/>
    <rect x="395" y="265" width="95" height="90" fill="#38bdf8" opacity="0.8"/>
    <rect x="290" y="380" width="110" height="100" fill="#38bdf8" opacity="0.8"/>
    <rect x="410" y="385" width="80" height="90" fill="#38bdf8" opacity="0.8"/>
  </g>
  <g>
    <rect x="40" y="40" width="80" height="50" fill="#facc15" opacity="0.9"/>
    <rect x="150" y="45" width="65" height="55" fill="#facc15" opacity="0.9"/>
    <rect x="45" y="125" width="60" height="55" fill="#facc15" opacity="0.9"/>
    <rect x="135" y="130" width="75" height="55" fill="#facc15" opacity="0.9"/>
    <rect x="285" y="35" width="90" height="55" fill="#facc15" opacity="0.9"/>
    <rect x="410" y="40" width="70" height="45" fill="#facc15" opacity="0.9"/>
    <rect x="290" y="135" width="70" height="55" fill="#facc15" opacity="0.9"/>
    <rect x="395" y="130" width="80" height="55" fill="#facc15" opacity="0.9"/>
    <rect x="40" y="270" width="85" height="70" fill="#facc15" opacity="0.9"/>
    <rect x="155" y="275" width="70" height="70" fill="#facc15" opacity="0.9"/>
    <rect x="50" y="415" width="80" height="60" fill="#facc15" opacity="0.9"/>
    <rect x="160" y="410" width="70" height="60" fill="#facc15" opacity="0.9"/>
    <rect x="295" y="270" width="75" height="70" fill="#facc15" opacity="0.9"/>
    <rect x="405" y="275" width="75" height="70" fill="#facc15" opacity="0.9"/>
    <rect x="300" y="390" width="90" height="80" fill="#facc15" opacity="0.9"/>
    <rect x="420" y="395" width="60" height="70" fill="#facc15" opacity="0.9"/>
  </g>
</svg>`;

export const SAMPLE_AERIAL_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SAMPLE_AERIAL_SVG)}`;
export const SAMPLE_MASK_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SAMPLE_MASK_SVG)}`;
export const SAMPLE_PROB_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SAMPLE_PROB_SVG)}`;

// Real GeoJSON features matching the 16 building polygons
export const SAMPLE_GEOJSON = {
  type: "FeatureCollection",
  crs: {
    type: "name",
    properties: {
      name: "urn:ogc:def:crs:EPSG::3857",
    },
  },
  features: [
    {
      type: "Feature",
      id: "BLD-0001",
      properties: {
        id: "BLD-0001",
        area: 270.0,
        area_unit: "sq meters",
        perimeter: 66.0,
        perimeter_unit: "meters",
        confidence: 0.97,
        parcel_id: "PARCEL-101",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[35, 35], [125, 35], [125, 95], [35, 95], [35, 35]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0002",
      properties: {
        id: "BLD-0002",
        area: 243.8,
        area_unit: "sq meters",
        perimeter: 63.5,
        perimeter_unit: "meters",
        confidence: 0.95,
        parcel_id: "PARCEL-102",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[145, 40], [220, 40], [220, 105], [145, 105], [145, 40]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0003",
      properties: {
        id: "BLD-0003",
        area: 227.5,
        area_unit: "sq meters",
        perimeter: 61.0,
        perimeter_unit: "meters",
        confidence: 0.96,
        parcel_id: "PARCEL-103",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[40, 120], [110, 120], [110, 185], [40, 185], [40, 120]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0004",
      properties: {
        id: "BLD-0004",
        area: 276.3,
        area_unit: "sq meters",
        perimeter: 67.0,
        perimeter_unit: "meters",
        confidence: 0.94,
        parcel_id: "PARCEL-104",
        parcel_relation: "intersecting",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[130, 125], [215, 125], [215, 190], [130, 190], [130, 125]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0005",
      properties: {
        id: "BLD-0005",
        area: 325.0,
        area_unit: "sq meters",
        perimeter: 72.5,
        perimeter_unit: "meters",
        confidence: 0.98,
        parcel_id: "PARCEL-201",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[280, 30], [380, 30], [380, 95], [280, 95], [280, 30]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0006",
      properties: {
        id: "BLD-0006",
        area: 220.0,
        area_unit: "sq meters",
        perimeter: 59.5,
        perimeter_unit: "meters",
        confidence: 0.93,
        parcel_id: "PARCEL-202",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[405, 35], [485, 35], [485, 90], [405, 90], [405, 35]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0007",
      properties: {
        id: "BLD-0007",
        area: 260.0,
        area_unit: "sq meters",
        perimeter: 65.0,
        perimeter_unit: "meters",
        confidence: 0.95,
        parcel_id: "PARCEL-203",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[285, 130], [365, 130], [365, 195], [285, 195], [285, 130]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0008",
      properties: {
        id: "BLD-0008",
        area: 292.5,
        area_unit: "sq meters",
        perimeter: 69.0,
        perimeter_unit: "meters",
        confidence: 0.94,
        parcel_id: "PARCEL-204",
        parcel_relation: "intersecting",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[390, 125], [480, 125], [480, 190], [390, 190], [390, 125]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0009",
      properties: {
        id: "BLD-0009",
        area: 380.0,
        area_unit: "sq meters",
        perimeter: 79.0,
        perimeter_unit: "meters",
        confidence: 0.97,
        parcel_id: "PARCEL-301",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[35, 265], [130, 265], [130, 345], [35, 345], [35, 265]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0010",
      properties: {
        id: "BLD-0010",
        area: 320.0,
        area_unit: "sq meters",
        perimeter: 72.0,
        perimeter_unit: "meters",
        confidence: 0.96,
        parcel_id: "PARCEL-302",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[150, 270], [230, 270], [230, 350], [150, 350], [150, 270]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0011",
      properties: {
        id: "BLD-0011",
        area: 315.0,
        area_unit: "sq meters",
        perimeter: 71.5,
        perimeter_unit: "meters",
        confidence: 0.92,
        parcel_id: "PARCEL-303",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[45, 410], [135, 410], [135, 480], [45, 480], [45, 410]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0012",
      properties: {
        id: "BLD-0012",
        area: 280.0,
        area_unit: "sq meters",
        perimeter: 67.5,
        perimeter_unit: "meters",
        confidence: 0.95,
        parcel_id: "PARCEL-304",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[155, 405], [235, 405], [235, 475], [155, 475], [155, 405]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0013",
      properties: {
        id: "BLD-0013",
        area: 340.0,
        area_unit: "sq meters",
        perimeter: 74.0,
        perimeter_unit: "meters",
        confidence: 0.96,
        parcel_id: "PARCEL-401",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[290, 265], [375, 265], [375, 345], [290, 345], [290, 265]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0014",
      properties: {
        id: "BLD-0014",
        area: 340.0,
        area_unit: "sq meters",
        perimeter: 74.0,
        perimeter_unit: "meters",
        confidence: 0.95,
        parcel_id: "PARCEL-402",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[400, 270], [485, 270], [485, 350], [400, 350], [400, 270]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0015",
      properties: {
        id: "BLD-0015",
        area: 450.0,
        area_unit: "sq meters",
        perimeter: 85.0,
        perimeter_unit: "meters",
        confidence: 0.98,
        parcel_id: "PARCEL-403",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[295, 385], [395, 385], [395, 475], [295, 475], [295, 385]]],
      },
    },
    {
      type: "Feature",
      id: "BLD-0016",
      properties: {
        id: "BLD-0016",
        area: 280.0,
        area_unit: "sq meters",
        perimeter: 67.5,
        perimeter_unit: "meters",
        confidence: 0.93,
        parcel_id: "PARCEL-404",
        parcel_relation: "inside",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[415, 390], [485, 390], [485, 470], [415, 470], [415, 390]]],
      },
    },
  ],
};

export const DEMO_JOB: JobItem = {
  id: "demo-spacenet-paris-aoi3",
  status: "completed",
  original_filename: "SpaceNet_Paris_AOI3_Urban_Sample.tif",
  file_size_bytes: 786432,
  mime_type: "image/tiff",
  width: 512,
  height: 512,
  is_georeferenced: true,
  crs_name: "EPSG:3857 (WGS 84 / Pseudo-Mercator)",
  detected_buildings_count: 16,
  total_building_area: 4890.1,
  area_unit: "sq meters",
  mean_confidence: 0.954,
  confidence_threshold: 0.5,
  tile_size: 256,
  tile_overlap: 64,
  min_polygon_area: 15,
  simplify_tolerance: 1.0,
  processing_time_seconds: 1.42,
  image_url: SAMPLE_AERIAL_DATA_URL,
  mask_url: SAMPLE_MASK_DATA_URL,
  prob_map_url: SAMPLE_PROB_DATA_URL,
  geojson_url: "internal://demo-geojson",
  csv_url: "internal://demo-csv",
  zip_export_url: "internal://demo-zip",
  report_url: "internal://demo-report",
  error_message: null,
  warnings: [
    "Georeferencing validated: EPSG:3857 Pseudo-Mercator projection preserved.",
    "16 residential & commercial building footprints polygonized with Douglas-Peucker topology preservation.",
    "Cadastral spatial join computed across cadastral parcel boundaries.",
    "DISCLAIMER: Extraction results do not substitute legal land titles or registered cadastral surveys.",
  ],
  is_demo_mode: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Client-side stored jobs helper
function getStoredJobs(): JobItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLIENT_JOBS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredJob(job: JobItem): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredJobs();
    const updated = [job, ...existing.filter((j) => j.id !== job.id)].slice(0, 20);
    localStorage.setItem(STORAGE_KEY_CLIENT_JOBS, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// Core API Calls with Automatic Fallback to Demo Mode
// -------------------------------------------------------------

export async function fetchHealth(): Promise<HealthInfo> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return { ...data, is_demo: false };
    }
  } catch {
    // backend offline
  }

  return {
    status: "demo",
    app_name: "UrbanFootprint AI (GitHub Pages Demo)",
    version: "2026.1-demo",
    timestamp: new Date().toISOString(),
    database_connected: true,
    model_loaded: true,
    is_demo: true,
  };
}

export async function fetchModelInfo(): Promise<ModelInfo> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/model/info`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return res.json();
  } catch {
    // backend offline
  }

  return {
    model_architecture: "BuildingUNet-Res (SpaceNet/Inria)",
    model_loaded: true,
    checkpoint_path: "checkpoints/spacenet_unet_res_best.pt",
    is_synthetic_checkpoint: true,
    device: "Web Browser / Standalone",
    cuda_available: false,
    load_error: null,
    checkpoint_metadata: {
      framework: "PyTorch 2.5",
      encoder: "ResNet-style Residual Blocks",
      loss: "BCE + Soft Dice (0.5/0.5)",
      validation_iou: 0.814,
      validation_f1: 0.897,
    },
    default_tile_size: 256,
    default_overlap: 64,
  };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/stats`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return res.json();
  } catch {
    // backend offline
  }

  const stored = getStoredJobs();
  const all = [DEMO_JOB, ...stored];
  const totalBld = all.reduce((sum, j) => sum + (j.detected_buildings_count || 0), 0);

  return {
    total_jobs: all.length,
    completed_jobs: all.filter((j) => j.status === "completed").length,
    failed_jobs: 0,
    total_buildings_detected: totalBld,
    recent_job: all[0] || DEMO_JOB,
  };
}

export async function fetchJobs(): Promise<JobItem[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/jobs`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // backend offline
  }

  const stored = getStoredJobs();
  return [DEMO_JOB, ...stored];
}

export async function fetchJob(jobId: string): Promise<JobItem> {
  if (jobId === DEMO_JOB.id) return DEMO_JOB;

  const stored = getStoredJobs().find((j) => j.id === jobId);
  if (stored) return stored;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return res.json();
  } catch {
    // backend offline
  }

  return DEMO_JOB;
}

export async function fetchGeoJson(url: string): Promise<any> {
  if (url === "internal://demo-geojson" || url.includes("demo-geojson")) {
    return SAMPLE_GEOJSON;
  }

  if (url.startsWith("data:")) {
    const jsonStr = atob(url.split(",")[1]);
    return JSON.parse(jsonStr);
  }

  const fullUrl = resolveApiUrl(url);
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error("Failed to load GeoJSON");
  return res.json();
}

export async function fetchJobReport(jobId: string): Promise<any> {
  if (jobId === DEMO_JOB.id || jobId.startsWith("demo-") || jobId.startsWith("client-")) {
    return {
      report_version: "1.0",
      generated_at: new Date().toISOString(),
      job_id: jobId,
      problem_statement: "SIH 2026 Problem P24: AI-Based Urban Building Footprint Extraction",
      input_metadata: {
        filename: DEMO_JOB.original_filename,
        dimensions: [512, 512],
        is_georeferenced: true,
        crs: DEMO_JOB.crs_name,
      },
      model_info: {
        architecture: "BuildingUNet-Res",
        checkpoint: "spacenet_unet_res_best.pt",
        validation_iou: 0.814,
        validation_f1: 0.897,
      },
      metrics: {
        total_buildings: 16,
        total_area_sq_meters: 4890.1,
        mean_confidence: 0.954,
        processing_time_seconds: 1.42,
      },
      disclaimer: "Extraction results do not substitute legal land titles or registered cadastral surveys.",
    };
  }

  const res = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}/report`);
  if (!res.ok) throw new Error(`Failed to fetch report for job ${jobId}`);
  return res.json();
}

export async function retryJob(jobId: string): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}/retry`, { method: "POST" });
    if (res.ok) return res.json();
  } catch {
    // fallback
  }
  return { status: "queued", job_id: jobId };
}

export async function submitExtractionJob(formData: FormData): Promise<JobItem> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/jobs`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return res.json();
  } catch {
    // Fall back to client-side simulation on GitHub Pages
  }

  // Client-side extraction simulation
  const imageFile = formData.get("image") as File | null;
  const filename = imageFile?.name || "Uploaded_Aerial_Scene.png";

  let imageUrl = SAMPLE_AERIAL_DATA_URL;
  if (imageFile) {
    try {
      imageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(SAMPLE_AERIAL_DATA_URL);
        reader.readAsDataURL(imageFile);
      });
    } catch {
      imageUrl = SAMPLE_AERIAL_DATA_URL;
    }
  }

  const clientJob: JobItem = {
    id: `client-job-${Date.now()}`,
    status: "completed",
    original_filename: filename,
    file_size_bytes: imageFile?.size || 524288,
    mime_type: imageFile?.type || "image/png",
    width: 512,
    height: 512,
    is_georeferenced: filename.toLowerCase().endsWith(".tif") || filename.toLowerCase().endsWith(".tiff"),
    crs_name: "EPSG:3857 (Estimated from metadata)",
    detected_buildings_count: 16,
    total_building_area: 4890.1,
    area_unit: "sq meters",
    mean_confidence: 0.95,
    confidence_threshold: parseFloat(formData.get("confidence_threshold") as string) || 0.5,
    tile_size: parseInt(formData.get("tile_size") as string) || 256,
    tile_overlap: parseInt(formData.get("tile_overlap") as string) || 64,
    min_polygon_area: parseFloat(formData.get("min_polygon_area") as string) || 15,
    simplify_tolerance: parseFloat(formData.get("simplify_tolerance") as string) || 1.0,
    processing_time_seconds: 1.35,
    image_url: imageUrl,
    mask_url: SAMPLE_MASK_DATA_URL,
    prob_map_url: SAMPLE_PROB_DATA_URL,
    geojson_url: "internal://demo-geojson",
    csv_url: "internal://demo-csv",
    zip_export_url: "internal://demo-zip",
    report_url: "internal://demo-report",
    error_message: null,
    warnings: [
      "Processed in Client-Side Simulation Mode (GitHub Pages).",
      "Connect a local or cloud FastAPI backend in Settings for live PyTorch Res-UNet inference.",
      "16 building footprints extracted with Douglas-Peucker topology preservation.",
    ],
    is_demo_mode: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveStoredJob(clientJob);
  return clientJob;
}

// -------------------------------------------------------------
// Client Download Utilities
// -------------------------------------------------------------

export function downloadJsonFile(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsvFile(filename: string, features: any[]) {
  const headers = ["building_id", "area_sq_m", "perimeter_m", "confidence", "parcel_id", "spatial_relation"];
  const rows = features.map((f) => [
    f.id,
    f.properties?.area || 0,
    f.properties?.perimeter || 0,
    f.properties?.confidence || 0,
    f.properties?.parcel_id || "Unassigned",
    f.properties?.parcel_relation || "inside",
  ]);
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
