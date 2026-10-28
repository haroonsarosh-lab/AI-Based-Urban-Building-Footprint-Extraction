"use client";

import React from "react";
import {
  ImageIcon,
  Building2,
  CheckCircle2,
  ArrowRight,
  FileCode,
  MapPin,
  UploadCloud,
  Layers,
  AlertTriangle,
  Cpu,
} from "./icons";
import { DashboardStats, JobItem, ModelInfo } from "../lib/api";

interface DashboardViewProps {
  stats: DashboardStats | null;
  jobs: JobItem[];
  modelInfo: ModelInfo | null;
  onSelectJob: (jobId: string) => void;
  onNavigate: (tab: string) => void;
}

export default function DashboardView({
  stats,
  jobs,
  modelInfo,
  onSelectJob,
  onNavigate,
}: DashboardViewProps) {
  const totalJobs = stats?.total_jobs ?? 0;
  const totalBuildings = stats?.total_buildings_detected ?? 0;
  const completedJobs = stats?.completed_jobs ?? 0;
  const failedJobs = stats?.failed_jobs ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Geospatial Extraction Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Real-time monitoring of semantic segmentation jobs, building footprint statistics, and GIS exports.
          </p>
        </div>
        <button
          onClick={() => onNavigate("extract")}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition"
        >
          <UploadCloud className="h-4 w-4" />
          <span>New Extraction</span>
        </button>
      </div>

      {/* Operational Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Processed */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Images Processed
            </span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <ImageIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{totalJobs}</span>
            <p className="text-xs text-slate-400 mt-0.5">
              {completedJobs} completed, {failedJobs} failed
            </p>
          </div>
        </div>

        {/* Detected Buildings */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Buildings Extracted
            </span>
            <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {totalBuildings.toLocaleString()}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              Polygonal GIS vector footprints
            </p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Success Rate
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {totalJobs > 0 ? `${Math.round((completedJobs / totalJobs) * 100)}%` : "100%"}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Automated quality validation</p>
          </div>
        </div>

        {/* Active AI Model */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AI Model Engine
            </span>
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-sm font-bold text-slate-900 block truncate">
              {modelInfo?.model_architecture || "BuildingUNet-Res"}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 mt-1">
              Device: {modelInfo?.device?.toUpperCase() || "CPU"} | Checkpoint:{" "}
              {modelInfo?.model_loaded ? "Loaded" : "None"}
            </span>
          </div>
        </div>
      </div>

      {/* Architecture & Pipeline Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-600" />
          <span>SIH 2026 Problem P24: End-to-End Processing Architecture</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs text-slate-600 mt-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="font-bold text-slate-800 mb-1">1. Raster Input</div>
            <p className="text-[11px] text-slate-500">
              High-resolution satellite/drone imagery (TIFF/GeoTIFF/PNG/JPEG). CRS & affine transform parsing.
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="font-bold text-slate-800 mb-1">2. Tiled AI Inference</div>
            <p className="text-[11px] text-slate-500">
              Overlapping patch sliding window (e.g. 512px) with Hann window edge blending to eliminate seams.
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="font-bold text-slate-800 mb-1">3. Polygon Extraction</div>
            <p className="text-[11px] text-slate-500">
              Contour hierarchy, courtyard hole preservation, Douglas-Peucker simplification & topology repair.
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="font-bold text-slate-800 mb-1">4. Cadastral Spatial Join</div>
            <p className="text-[11px] text-slate-500">
              Optional parcel boundary overlay (inside/intersecting/outside). Area in m² or pixels.
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="font-bold text-slate-800 mb-1">5. GIS-Ready Exports</div>
            <p className="text-[11px] text-slate-500">
              GeoJSON with CRS metadata, attribute CSV, mask PNGs, and downloadable processing audit report.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Extraction Jobs Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent Extraction Jobs</h2>
            <p className="text-xs text-slate-500">History of raster segmentation runs</p>
          </div>
          <button
            onClick={() => onNavigate("extract")}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            <span>Start Extraction</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ImageIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">No processing jobs yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Upload aerial imagery or drone photography to detect building footprints and generate GIS polygons.
            </p>
            <button
              onClick={() => onNavigate("extract")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload Imagery</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Dimensions</th>
                  <th className="py-3 px-4">Georeference</th>
                  <th className="py-3 px-4">Buildings</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {job.id}
                    </td>
                    <td className="py-3 px-4 font-medium max-w-xs truncate">
                      {job.original_filename}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {job.width && job.height ? `${job.width} × ${job.height}` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      {job.is_georeferenced ? (
                        <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 border border-teal-200">
                          <MapPin className="h-2.5 w-2.5" />
                          <span>{job.crs_name || "Georeferenced"}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Pixel Space</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {job.detected_buildings_count}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          job.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : job.status === "processing"
                            ? "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse"
                            : job.status === "failed"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {job.processing_time_seconds ? `${job.processing_time_seconds}s` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          onSelectJob(job.id);
                          onNavigate("workspace");
                        }}
                        className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition"
                      >
                        View GIS Workspace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
