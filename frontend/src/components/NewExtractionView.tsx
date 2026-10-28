"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileImage,
  Sliders,
  AlertCircle,
  CheckCircle,
  FileText,
  MapPin,
  Sparkles,
} from "./icons";
import { submitExtractionJob, JobItem, ModelInfo } from "../lib/api";

interface NewExtractionViewProps {
  modelInfo: ModelInfo | null;
  onJobCreated: (job: JobItem) => void;
  onNavigate: (tab: string) => void;
}

export default function NewExtractionView({
  modelInfo,
  onJobCreated,
  onNavigate,
}: NewExtractionViewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number; size: string } | null>(null);

  const [parcelFile, setParcelFile] = useState<File | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.50);
  const [tileSize, setTileSize] = useState<number>(512);
  const [tileOverlap, setTileOverlap] = useState<number>(64);
  const [minPolygonArea, setMinPolygonArea] = useState<number>(15.0);
  const [simplifyTolerance, setSimplifyTolerance] = useState<number>(0.8);
  const [allowDemoMode, setAllowDemoMode] = useState<boolean>(!modelInfo?.model_loaded);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parcelInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    setErrorMessage(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["png", "jpg", "jpeg", "tif", "tiff", "geotiff"];
    if (!ext || !validExts.includes(ext)) {
      setErrorMessage(`Unsupported file format .${ext}. Please upload PNG, JPG, or TIFF/GeoTIFF.`);
      return;
    }

    setSelectedFile(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);

    // Read image dimensions if standard web format
    if (["png", "jpg", "jpeg"].includes(ext)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      const img = new Image();
      img.onload = () => {
        setImageMeta({ width: img.width, height: img.height, size: `${sizeMb} MB` });
      };
      img.src = url;
    } else {
      // TIFF preview representation
      setPreviewUrl(null);
      setImageMeta({ width: 0, height: 0, size: `${sizeMb} MB` });
    }
  };

  const loadSampleSyntheticRaster = async () => {
    // Generate an in-browser sample canvas image with building rooftops and streets
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Grass / urban background
    ctx.fillStyle = "#556b2f";
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt highway
    ctx.fillStyle = "#374151";
    ctx.fillRect(0, 230, 512, 52);
    // Road dashed line
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.stroke();

    // 8 building footprints
    const buildings = [
      { x: 40, y: 50, w: 90, h: 70, color: "#b91c1c" },
      { x: 180, y: 40, w: 120, h: 90, color: "#cbd5e1" },
      { x: 350, y: 60, w: 100, h: 80, color: "#475569" },
      { x: 50, y: 340, w: 110, h: 95, color: "#d97706" },
      { x: 210, y: 350, w: 85, h: 75, color: "#94a3b8" },
      { x: 340, y: 330, w: 125, h: 110, color: "#b45309" },
    ];

    buildings.forEach((b) => {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "sample_urban_aerial_512.png", { type: "image/png" });
      handleFileChange(file);
    }, "image/png");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select or drop an aerial image to process.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      if (parcelFile) {
        formData.append("parcels", parcelFile);
      }
      formData.append("confidence_threshold", confidenceThreshold.toString());
      formData.append("tile_size", tileSize.toString());
      formData.append("tile_overlap", tileOverlap.toString());
      formData.append("min_polygon_area", minPolygonArea.toString());
      formData.append("simplify_tolerance", simplifyTolerance.toString());
      formData.append("allow_demo_mode", allowDemoMode ? "true" : "false");

      const job = await submitExtractionJob(formData);
      onJobCreated(job);
      onNavigate("workspace");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          New Building Footprint Extraction
        </h1>
        <p className="text-sm text-slate-500">
          Upload satellite or drone imagery to perform semantic segmentation and generate vector polygons.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Extraction Notice: </span>
            {errorMessage}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileChange(e.dataTransfer.files[0]);
            }
          }}
          className={`relative rounded-xl border-2 border-dashed p-8 text-center transition ${
            isDragging
              ? "border-sky-500 bg-sky-50/50"
              : "border-slate-300 bg-white hover:border-slate-400"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.tif,.tiff,.geotiff"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <FileImage className="h-8 w-8 text-sky-600" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">
                    {imageMeta?.size} {imageMeta?.width ? `• ${imageMeta.width} × ${imageMeta.height} px` : ""}
                  </p>
                </div>
              </div>

              {previewUrl && (
                <div className="mx-auto max-w-xs overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                  <img src={previewUrl} alt="Preview" className="h-44 w-full object-cover" />
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700"
              >
                Change Selected Image
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Drag and drop aerial raster, or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sky-600 underline hover:text-sky-700 font-medium"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports GeoTIFF (.tif, .tiff), PNG, and JPEG. Automatic CRS and geotransform detection.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={loadSampleSyntheticRaster}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Load Sample Aerial Patch (512x512)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Optional Cadastral Boundary Upload */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-teal-600" />
                <span>Optional Cadastral / Parcel Boundary Layer</span>
              </span>
              <p className="text-xs text-slate-500">
                Upload GeoJSON parcel vectors to perform building-to-parcel spatial overlays (inside/intersecting/outside).
              </p>
            </div>
            <input
              ref={parcelInputRef}
              type="file"
              accept=".geojson,.json"
              onChange={(e) => setParcelFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => parcelInputRef.current?.click()}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              {parcelFile ? "Change Parcel File" : "Select GeoJSON"}
            </button>
          </div>
          {parcelFile && (
            <div className="rounded-lg bg-teal-50 border border-teal-200 p-2.5 text-xs text-teal-900 flex items-center justify-between">
              <span>Attached: <strong>{parcelFile.name}</strong></span>
              <button
                type="button"
                onClick={() => setParcelFile(null)}
                className="text-teal-700 hover:text-teal-900 text-xs font-semibold"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Inference & Geometry Configuration */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="h-4 w-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Segmentation & Vectorization Parameters
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Confidence Threshold */}
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Confidence Threshold</span>
                <span className="font-mono font-bold text-sky-600">
                  {Math.round(confidenceThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Probability cutoff for classifying a pixel as building footprint.
              </p>
            </div>

            {/* Minimum Polygon Area */}
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Minimum Building Area</span>
                <span className="font-mono font-bold text-sky-600">{minPolygonArea} sq units</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={minPolygonArea}
                onChange={(e) => setMinPolygonArea(parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Eliminates small noise artifacts and fragmented vegetation masks.
              </p>
            </div>

            {/* Tile Window Size */}
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Patch Tiling Size</span>
                <span className="font-mono font-bold text-sky-600">{tileSize} × {tileSize} px</span>
              </div>
              <select
                value={tileSize}
                onChange={(e) => setTileSize(parseInt(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800"
              >
                <option value="256">256 × 256 (Fast / Low Memory)</option>
                <option value="512">512 × 512 (Standard SpaceNet/Inria)</option>
                <option value="1024">1024 × 1024 (Large Context)</option>
              </select>
            </div>

            {/* Tile Overlap */}
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Tile Overlap</span>
                <span className="font-mono font-bold text-sky-600">{tileOverlap} px</span>
              </div>
              <select
                value={tileOverlap}
                onChange={(e) => setTileOverlap(parseInt(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800"
              >
                <option value="32">32 px (Fastest)</option>
                <option value="64">64 px (Balanced Blending)</option>
                <option value="128">128 px (High Boundary Consistency)</option>
              </select>
            </div>

            {/* Simplify Tolerance */}
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Polygon Simplification (Douglas-Peucker)</span>
                <span className="font-mono font-bold text-sky-600">{simplifyTolerance}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="3.0"
                step="0.2"
                value={simplifyTolerance}
                onChange={(e) => setSimplifyTolerance(parseFloat(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Removes staircase pixelation along building boundaries while preserving corners.
              </p>
            </div>

            {/* Demo / Synthetic Checkbox */}
            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="demoMode"
                checked={allowDemoMode}
                onChange={(e) => setAllowDemoMode(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="demoMode" className="text-xs text-slate-700 font-medium">
                Allow Synthetic Test Mode (if weights unavailable)
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedFile}
            className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition ${
              isSubmitting || !selectedFile
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting Job...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                <span>Start Extraction Job</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
