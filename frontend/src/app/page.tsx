"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import DashboardView from "../components/DashboardView";
import NewExtractionView from "../components/NewExtractionView";
import ResultsWorkspaceView from "../components/ResultsWorkspaceView";
import DatasetsView from "../components/DatasetsView";
import TrainingView from "../components/TrainingView";
import SettingsView from "../components/SettingsView";
import {
  fetchHealth,
  fetchModelInfo,
  fetchDashboardStats,
  fetchJobs,
  HealthInfo,
  ModelInfo,
  DashboardStats,
  JobItem,
} from "../lib/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Initial and periodic data fetch
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [h, m, s, j] = await Promise.all([
          fetchHealth().catch(() => null),
          fetchModelInfo().catch(() => null),
          fetchDashboardStats().catch(() => null),
          fetchJobs().catch(() => []),
        ]);

        if (!isMounted) return;
        setHealth(h);
        setModelInfo(m);
        setStats(s);
        setJobs(j);

        // Auto-select recent job if none selected
        if (!currentJobId && j.length > 0) {
          setCurrentJobId(j[0].id);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshTrigger]);

  const handleJobCreated = (newJob: JobItem) => {
    setCurrentJobId(newJob.id);
    setJobs((prev) => [newJob, ...prev]);
    setRefreshTrigger((n) => n + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation Bar */}
      <Navbar
        health={health}
        modelInfo={modelInfo}
        onNavigate={setActiveTab}
        activeTab={activeTab}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Compact Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onNavigate={setActiveTab}
          hasActiveJob={!!currentJobId}
        />

        {/* Dynamic Workspace Container */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "dashboard" && (
            <DashboardView
              stats={stats}
              jobs={jobs}
              modelInfo={modelInfo}
              onSelectJob={(id) => setCurrentJobId(id)}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === "extract" && (
            <NewExtractionView
              modelInfo={modelInfo}
              onJobCreated={handleJobCreated}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === "workspace" && (
            <ResultsWorkspaceView
              currentJobId={currentJobId}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === "datasets" && <DatasetsView />}

          {activeTab === "training" && <TrainingView modelInfo={modelInfo} />}

          {activeTab === "settings" && (
            <SettingsView
              health={health}
              modelInfo={modelInfo}
              onRefreshHealth={() => setRefreshTrigger((n) => n + 1)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
