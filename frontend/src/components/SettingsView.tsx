"use client";

import React, { useState, useEffect } from "react";
import { Server, Shield, RefreshCw, Sparkles, CheckCircle2 } from "./icons";
import {
  getApiBaseUrl,
  setApiBaseUrl,
  fetchHealth,
  HealthInfo,
  ModelInfo,
  DEMO_JOB,
} from "../lib/api";

interface SettingsViewProps {
  health: HealthInfo | null;
  modelInfo: ModelInfo | null;
  onRefreshHealth: () => void;
}

export default function SettingsView({ health, modelInfo, onRefreshHealth }: SettingsViewProps) {
  const [apiUrl, setApiUrl] = useState<string>("");
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    setApiUrl(getApiBaseUrl());
  }, []);

  const handleSaveUrl = () => {
    setApiBaseUrl(apiUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    handleTestConnection();
  };

  const handleResetDefault = () => {
    const defaultUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    setApiUrl(defaultUrl);
    setApiBaseUrl("");
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    onRefreshHealth();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const h = await fetchHealth();
      if (h.is_demo) {
        setTestResult({
          ok: true,
          msg: "Connected in Client-Side Demonstration Mode (GitHub Pages). Real-time sample data & visualization active.",
        });
      } else {
        setTestResult({
          ok: true,
          msg: `Connected to Live FastAPI Backend! Service: ${h.app_name} (${h.version})`,
        });
      }
      onRefreshHealth();
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: `Connection Failed: ${err.message}. Ensure backend is running and CORS allows origin.`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Configuration & Health</h1>
        <p className="text-sm text-slate-500">
          Backend API endpoints, geospatial processing runtime, hardware acceleration, and legal disclaimers.
        </p>
      </div>

      {/* Deployment & Environment Banner */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-950 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-sky-900">GitHub Pages Static Deployment Active</div>
          <p className="text-sky-800 leading-relaxed">
            The frontend is deployed as a high-performance static SPA on GitHub Pages. You can explore the full interactive GIS workspace, building polygon overlays, and attributes table using the built-in SpaceNet sample dataset, or point the API URL below to your self-hosted FastAPI backend.
          </p>
        </div>
      </div>

      {/* Backend Connection */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900">Backend Server Connection</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              health?.status === "ok"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-sky-50 text-sky-700 border border-sky-200"
            }`}
          >
            {health?.status === "ok" ? "Live Backend" : "Demo Mode Active"}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Backend API Base URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000 or https://your-backend.onrender.com"
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-800 focus:bg-white focus:outline-sky-500"
              />
              <button
                onClick={handleSaveUrl}
                className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 transition"
              >
                Save
              </button>
              <button
                onClick={handleResetDefault}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Reset
              </button>
            </div>
            {saveSuccess && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Saved to browser local storage.
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Connect to your local FastAPI server (default: <code className="bg-slate-100 px-1 py-0.5 rounded">http://127.0.0.1:8000</code>) or a cloud service (Render, Railway, Fly.io).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Model Architecture</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 font-medium">
                {modelInfo?.model_architecture || "BuildingUNet-Res (Residual U-Net)"}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Device: {modelInfo?.device || "CPU"}</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Database Connectivity</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-slate-800 font-medium">SQLite Persistent Storage Active</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">backend/urbanfootprint.db</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testingConnection ? "animate-spin" : ""}`} />
            <span>Test Connection Health</span>
          </button>
          {testResult && (
            <span
              className={`text-xs font-medium ${
                testResult.ok ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {testResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Cadastral Legal Disclaimer */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Cadastral & Legal Geospatial Regulatory Notice
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Automated building footprint segmentation and spatial parcel overlays are designed for urban planning, municipal asset indexing, disaster response, and spatial analytics.
        </p>
        <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-3.5 text-xs text-amber-950 font-medium leading-relaxed">
          DISCLAIMER: Extraction results and spatial joins generated by UrbanFootprint AI do NOT constitute legal cadastral boundary demarcation, land-title validation, or legal real-estate ownership. Official property boundaries require legally registered revenue survey documentation.
        </div>
      </div>
    </div>
  );
}
