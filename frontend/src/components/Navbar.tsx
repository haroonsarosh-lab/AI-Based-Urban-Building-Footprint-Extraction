"use client";

import React from "react";
import { Layers, Cpu, UploadCloud, AlertCircle } from "./icons";
import { HealthInfo, ModelInfo } from "../lib/api";

interface NavbarProps {
  health: HealthInfo | null;
  modelInfo: ModelInfo | null;
  onNavigate: (tab: string) => void;
  activeTab: string;
}

export default function Navbar({ health, modelInfo, onNavigate, activeTab }: NavbarProps) {
  const isOnline = health?.status === "ok";
  const modelReady = modelInfo?.model_loaded;
  const isSynthetic = modelInfo?.is_synthetic_checkpoint;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sky-400 shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-slate-900 text-lg">
                UrbanFootprint AI
              </span>
              <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 border border-sky-200">
                SIH 2026 P24
              </span>
            </div>
            <p className="text-xs text-slate-500">
              AI-Powered Building Footprint Extraction & Geospatial Mapping
            </p>
          </div>
        </div>

        {/* System Health Badges & Quick Action */}
        <div className="flex items-center gap-4">
          {/* Backend Status */}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            <span
              className={`h-2 w-2 rounded-full ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span>API: {isOnline ? "Online" : "Connecting..."}</span>
          </div>

          {/* Model Status */}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            <Cpu className="h-3.5 w-3.5 text-slate-500" />
            <span>
              {modelReady
                ? isSynthetic
                  ? "Res-UNet (Synthetic Checkpoint)"
                  : "Res-UNet Active"
                : "No Checkpoint (Demo Mode)"}
            </span>
            <span className="rounded bg-slate-200 px-1 text-[10px] uppercase font-bold text-slate-600">
              {modelInfo?.device || "CPU"}
            </span>
          </div>

          {/* New Extraction CTA */}
          <button
            onClick={() => onNavigate("extract")}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
          >
            <UploadCloud className="h-4 w-4" />
            <span>New Extraction</span>
          </button>
        </div>
      </div>
    </header>
  );
}
