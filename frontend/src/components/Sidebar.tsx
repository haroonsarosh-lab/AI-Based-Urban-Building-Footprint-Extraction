"use client";

import React from "react";
import {
  LayoutDashboard,
  UploadCloud,
  Layers,
  Database,
  Cpu,
  Settings,
} from "./icons";

interface SidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  hasActiveJob: boolean;
}

export default function Sidebar({ activeTab, onNavigate, hasActiveJob }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "extract", label: "New Extraction", icon: UploadCloud },
    {
      id: "workspace",
      label: "GIS Workspace",
      icon: Layers,
      badge: hasActiveJob ? "Active" : undefined,
    },
    { id: "datasets", label: "Datasets & Attribution", icon: Database },
    { id: "training", label: "Training & Evaluation", icon: Cpu },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        <div>
          <span className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? "text-sky-400" : "text-slate-500"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isActive ? "bg-sky-500 text-white" : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* SIH 2026 Problem Context Pill */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
          <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
            <span>Problem P24</span>
            <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded text-slate-700">MoHUA / ISRO</span>
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            AI-based automated footprint polygonization & cadastral parcel alignment from high-resolution aerial and drone imagery.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-slate-100 pt-3 text-xs text-slate-400 flex items-center justify-between">
        <span>v1.0.0 Production</span>
        <span className="font-mono text-[10px] text-slate-500">FastAPI + PyTorch</span>
      </div>
    </aside>
  );
}
