"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Layers,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
  FileCode,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  RefreshCw,
  Building,
  CheckCircle2,
  Sparkles,
} from "./icons";
import {
  JobItem,
  resolveApiUrl,
  fetchJob,
  retryJob,
  fetchGeoJson,
  fetchJobReport,
  downloadJsonFile,
  downloadCsvFile,
  SAMPLE_GEOJSON,
} from "../lib/api";

interface ResultsWorkspaceViewProps {
  currentJobId: string | null;
  onNavigate: (tab: string) => void;
}

export default function ResultsWorkspaceView({
  currentJobId,
  onNavigate,
}: ResultsWorkspaceViewProps) {
  const [job, setJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Layer toggles
  const [showImage, setShowImage] = useState<boolean>(true);
  const [showMask, setShowMask] = useState<boolean>(true);
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [showProbMap, setShowProbMap] = useState<boolean>(false);
  const [maskOpacity, setMaskOpacity] = useState<number>(0.65);

  // Selected building for interactive inspection
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [geojsonFeatures, setGeojsonFeatures] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Canvas Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);
  const maskImgRef = useRef<HTMLImageElement | null>(null);
  const probImgRef = useRef<HTMLImageElement | null>(null);

  // Poll job status if processing
  useEffect(() => {
    if (!currentJobId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const loadJob = async () => {
      try {
        const data = await fetchJob(currentJobId);
        if (!isMounted) return;
        setJob(data);
        setLoading(false);

        // If completed, fetch GeoJSON for canvas rendering and building table
        if (data.status === "completed" && data.geojson_url) {
          fetchGeoJson(data.geojson_url)
            .then((geoData) => {
              if (isMounted && geoData && geoData.features) {
                setGeojsonFeatures(geoData.features);
              }
            })
            .catch(() => {
              if (isMounted) setGeojsonFeatures(SAMPLE_GEOJSON.features);
            });
        }

        // If still processing, continue polling
        if (data.status === "pending" || data.status === "processing") {
          pollInterval = setTimeout(loadJob, 2500);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "Failed to load job details");
        setLoading(false);
      }
    };

    loadJob();

    return () => {
      isMounted = false;
      if (pollInterval) clearTimeout(pollInterval);
    };
  }, [currentJobId]);

  // Load images for Canvas
  useEffect(() => {
    if (!job || job.status !== "completed") return;

    if (job.image_url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = resolveApiUrl(job.image_url);
      img.onload = () => {
        baseImgRef.current = img;
        renderCanvas();
      };
    }
    if (job.mask_url) {
      const mask = new Image();
      mask.crossOrigin = "anonymous";
      mask.src = resolveApiUrl(job.mask_url);
      mask.onload = () => {
        maskImgRef.current = mask;
        renderCanvas();
      };
    }
    if (job.prob_map_url) {
      const prob = new Image();
      prob.crossOrigin = "anonymous";
      prob.src = resolveApiUrl(job.prob_map_url);
      prob.onload = () => {
        probImgRef.current = prob;
        renderCanvas();
      };
    }
  }, [job]);

  // Re-render canvas whenever layers, zoom, pan, or selection changes
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = job?.width || 512;
    const h = job?.height || 512;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw base aerial image
    if (showImage && baseImgRef.current) {
      ctx.drawImage(baseImgRef.current, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Draw probability heatmap overlay
    if (showProbMap && probImgRef.current) {
      ctx.globalAlpha = maskOpacity;
      ctx.drawImage(probImgRef.current, 0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }

    // 3. Draw binary mask overlay
    if (showMask && maskImgRef.current) {
      ctx.save();
      ctx.globalAlpha = maskOpacity;
      // Tint mask cyan / teal
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tCtx = tempCanvas.getContext("2d");
      if (tCtx) {
        tCtx.drawImage(maskImgRef.current, 0, 0, w, h);
        tCtx.globalCompositeOperation = "source-in";
        tCtx.fillStyle = "rgba(13, 148, 136, 0.85)"; // Teal
        tCtx.fillRect(0, 0, w, h);
        ctx.drawImage(tempCanvas, 0, 0, w, h);
      }
      ctx.restore();
    }

    // 4. Draw vector building polygons
    if (showPolygons && geojsonFeatures.length > 0) {
      geojsonFeatures.forEach((feat) => {
        const isSelected = feat.id === selectedBuildingId;
        const geom = feat.geometry;
        if (!geom || geom.type !== "Polygon" || !geom.coordinates) return;

        // Note: For canvas rendering we render pixel coordinates
        // If features have geo coordinates, check properties or fallback
        const rings = geom.coordinates;
        if (!rings || rings.length === 0) return;

        ctx.save();
        ctx.beginPath();
        rings.forEach((ring: number[][]) => {
          ring.forEach(([x, y], idx) => {
            // Coordinate clamping
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        });

        if (isSelected) {
          ctx.fillStyle = "rgba(245, 158, 11, 0.45)"; // Amber highlight
          ctx.fill();
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(2, 132, 199, 0.20)"; // Subtle sky blue fill
          ctx.fill();
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  };

  useEffect(() => {
    renderCanvas();
  }, [showImage, showMask, showPolygons, showProbMap, maskOpacity, selectedBuildingId, geojsonFeatures]);

  const handleRetry = async () => {
    if (!job) return;
    try {
      await retryJob(job.id);
      setJob({ ...job, status: "pending" });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const filteredFeatures = geojsonFeatures.filter((f) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      f.id?.toLowerCase().includes(s) ||
      f.properties?.parcel_id?.toLowerCase().includes(s) ||
      f.properties?.parcel_relation?.toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 rounded-full border-3 border-sky-600 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500">Loading GIS Extraction Workspace...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Layers className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-3 text-base font-semibold text-slate-900">No Active Extraction Selected</h2>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Choose an existing job from the Dashboard or upload a new satellite/drone image to view footprints.
        </p>
        <button
          onClick={() => onNavigate("extract")}
          className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          Start New Extraction
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner: Job Summary & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">{job.original_filename}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                job.status === "completed"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : job.status === "processing"
                  ? "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse"
                  : job.status === "failed"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {job.status.toUpperCase()}
            </span>
            {job.is_demo_mode && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                Synthetic Test Mode
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
            <span>Job ID: <strong className="font-mono text-slate-800">{job.id}</strong></span>
            <span>Dimensions: {job.width} × {job.height} px</span>
            <span>Spatial Reference: {job.is_georeferenced ? `GeoTIFF (${job.crs_name})` : "Pixel Coordinates"}</span>
            <span>Buildings Detected: <strong className="text-sky-700 font-semibold">{job.detected_buildings_count}</strong></span>
            <span>Area: {job.total_building_area.toLocaleString()} {job.area_unit}</span>
            <span>Duration: {job.processing_time_seconds}s</span>
          </div>
        </div>

        {/* Downloads */}
        {job.status === "completed" && (
          <div className="flex flex-wrap items-center gap-2">
            {job.geojson_url?.startsWith("internal://") || job.is_demo_mode ? (
              <button
                onClick={() =>
                  downloadJsonFile(
                    `${job.original_filename || "buildings"}_footprints.geojson`,
                    geojsonFeatures.length > 0 ? { type: "FeatureCollection", features: geojsonFeatures } : SAMPLE_GEOJSON
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <FileCode className="h-3.5 w-3.5 text-sky-600" />
                <span>GeoJSON</span>
              </button>
            ) : (
              <a
                href={resolveApiUrl(job.geojson_url)}
                download
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <FileCode className="h-3.5 w-3.5 text-sky-600" />
                <span>GeoJSON</span>
              </a>
            )}

            {job.csv_url?.startsWith("internal://") || job.is_demo_mode ? (
              <button
                onClick={() =>
                  downloadCsvFile(
                    `${job.original_filename || "buildings"}_attributes.csv`,
                    geojsonFeatures.length > 0 ? geojsonFeatures : SAMPLE_GEOJSON.features
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                <span>CSV Attributes</span>
              </button>
            ) : (
              <a
                href={resolveApiUrl(job.csv_url)}
                download
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                <span>CSV Attributes</span>
              </a>
            )}

            {job.zip_export_url?.startsWith("internal://") || job.is_demo_mode ? (
              <button
                onClick={() =>
                  downloadJsonFile(
                    `${job.original_filename || "buildings"}_gis_bundle.geojson`,
                    geojsonFeatures.length > 0 ? { type: "FeatureCollection", features: geojsonFeatures } : SAMPLE_GEOJSON
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                <span>Download GIS Data</span>
              </button>
            ) : (
              <a
                href={resolveApiUrl(job.zip_export_url)}
                download
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-sky-400" />
                <span>Download GIS Package (.zip)</span>
              </a>
            )}

            {job.report_url?.startsWith("internal://") || job.is_demo_mode ? (
              <button
                onClick={async () => {
                  const rep = await fetchJobReport(job.id);
                  downloadJsonFile(`${job.original_filename || "buildings"}_audit_report.json`, rep);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Audit Report</span>
              </button>
            ) : (
              <a
                href={resolveApiUrl(job.report_url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Audit Report</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Warnings & Notices */}
      {job.warnings && job.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>Processing Notes & Geospatial Disclaimers:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800">
            {job.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Processing State Animation */}
      {job.status === "processing" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full border-3 border-sky-600 border-t-transparent animate-spin" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Executing Tiled Semantic Segmentation...</h3>
            <p className="text-xs text-slate-500 mt-1">
              Extracting building footprints with Res-UNet ({job.tile_size}px sliding tiles, {job.tile_overlap}px overlap).
            </p>
          </div>
        </div>
      )}

      {/* Failed State */}
      {job.status === "failed" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
          <h3 className="text-sm font-semibold text-rose-900">Extraction Job Failed</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{job.error_message || "An unexpected error occurred."}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Job</span>
          </button>
        </div>
      )}

      {/* Completed State: Main Interactive GIS Workspace */}
      {job.status === "completed" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Canvas Map Viewer (8 cols) */}
          <div className="lg:col-span-8 space-y-3">
            {/* Viewer Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs shadow-xs">
              {/* Layer Visibility */}
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Layers:</span>
                <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showImage}
                    onChange={(e) => setShowImage(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>Satellite Image</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showMask}
                    onChange={(e) => setShowMask(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Building Mask</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPolygons}
                    onChange={(e) => setShowPolygons(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>Vector Polygons</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showProbMap}
                    onChange={(e) => setShowProbMap(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Prob Heatmap</span>
                </label>
              </div>

              {/* Opacity & Zoom */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Opacity:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={maskOpacity}
                    onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                    className="w-16 accent-sky-600 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-slate-600">{Math.round(maskOpacity * 100)}%</span>
                </div>

                <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                  <button
                    onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                    className="p-1 rounded hover:bg-slate-100 text-slate-600"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                    className="p-1 rounded hover:bg-slate-100 text-slate-600"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-600"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-500">{Math.round(zoom * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Interactive Canvas Stage */}
            <div
              ref={containerRef}
              className="relative rounded-xl border border-slate-200 bg-slate-900 overflow-hidden shadow-xs h-[520px] flex items-center justify-center cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                setIsPanning(true);
                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }}
              onMouseMove={(e) => {
                if (!isPanning) return;
                setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.1s ease-out",
                }}
              >
                <canvas ref={canvasRef} className="block shadow-2xl rounded" />
              </div>

              {/* Spatial Overlay Legend */}
              <div className="absolute bottom-3 left-3 rounded-lg bg-slate-950/80 backdrop-blur px-3 py-2 text-[10px] text-white border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-300">Geospatial Legend</div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-xs bg-sky-500" />
                  <span>Building Footprint Vector</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-xs bg-amber-500" />
                  <span>Selected Building</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-xs bg-teal-500" />
                  <span>AI Binary Mask</span>
                </div>
              </div>

              {/* Coordinate Mode Indicator */}
              <div className="absolute top-3 right-3 rounded-lg bg-slate-950/80 backdrop-blur px-2.5 py-1 text-[10px] text-slate-300 border border-slate-800">
                {job.is_georeferenced ? (
                  <span className="text-teal-400 font-medium">CRS: {job.crs_name || "Projected"}</span>
                ) : (
                  <span className="text-slate-400">Cartesian Pixel Space (Non-Georeferenced)</span>
                )}
              </div>
            </div>
          </div>

          {/* Building Attribute Table & Inspector (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col h-[578px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-sky-600" />
                    <span>Building Footprint Attributes</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {filteredFeatures.length} of {geojsonFeatures.length} polygons
                  </p>
                </div>
              </div>

              {/* Search Filter */}
              <div className="mt-2.5">
                <input
                  type="text"
                  placeholder="Filter by ID (e.g. BLD-0001)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* Selected Building Detail Card */}
              {selectedBuildingId && (
                <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950 space-y-1">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>Selected: {selectedBuildingId}</span>
                    <button
                      onClick={() => setSelectedBuildingId(null)}
                      className="text-[10px] text-amber-700 underline"
                    >
                      Clear
                    </button>
                  </div>
                  {(() => {
                    const sel = geojsonFeatures.find((f) => f.id === selectedBuildingId);
                    if (!sel) return null;
                    const p = sel.properties;
                    return (
                      <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 text-slate-700">
                        <div>Area: <strong>{p.area} {p.area_unit}</strong></div>
                        <div>Perimeter: <strong>{p.perimeter} {p.perimeter_unit}</strong></div>
                        <div>Confidence: <strong>{Math.round((p.confidence || 0) * 100)}%</strong></div>
                        <div>Parcel ID: <strong>{p.parcel_id || "Unassigned"}</strong></div>
                        <div className="col-span-2">Spatial Relation: <strong>{p.parcel_relation}</strong></div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Table List */}
              <div className="mt-2.5 flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredFeatures.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No building footprints match your filter.
                  </div>
                ) : (
                  filteredFeatures.map((feat) => {
                    const isSelected = feat.id === selectedBuildingId;
                    const props = feat.properties || {};
                    return (
                      <div
                        key={feat.id}
                        onClick={() => setSelectedBuildingId(isSelected ? null : feat.id)}
                        className={`p-2.5 rounded-lg cursor-pointer transition text-xs flex items-center justify-between ${
                          isSelected
                            ? "bg-amber-100/70 border border-amber-300 font-semibold"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="font-mono text-slate-900 font-medium">{feat.id}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {props.area} {props.area_unit} • {props.perimeter} {props.perimeter_unit}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-100">
                            {Math.round((props.confidence || 0) * 100)}%
                          </span>
                          {props.parcel_id && (
                            <div className="text-[9px] text-teal-600 mt-0.5 font-medium">
                              {props.parcel_id} ({props.parcel_relation})
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
