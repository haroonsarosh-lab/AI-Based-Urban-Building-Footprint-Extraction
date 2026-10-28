/**
 * UrbanFootprint AI - Frontend API Client
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface HealthInfo {
  status: string;
  app_name: string;
  version: string;
  timestamp: string;
  database_connected: boolean;
  model_loaded: boolean;
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

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error("Backend service unavailable");
  return res.json();
}

export async function fetchModelInfo(): Promise<ModelInfo> {
  const res = await fetch(`${API_BASE_URL}/api/model/info`);
  if (!res.ok) throw new Error("Failed to fetch model info");
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE_URL}/api/stats`);
  if (!res.ok) throw new Error("Failed to fetch statistics");
  return res.json();
}

export async function fetchJobs(): Promise<JobItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/jobs`);
  if (!res.ok) throw new Error("Failed to fetch job list");
  return res.json();
}

export async function fetchJob(jobId: string): Promise<JobItem> {
  const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Failed to fetch job ${jobId}`);
  return res.json();
}

export async function fetchJobReport(jobId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/report`);
  if (!res.ok) throw new Error(`Failed to fetch report for job ${jobId}`);
  return res.json();
}

export async function retryJob(jobId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to retry job ${jobId}`);
  return res.json();
}

export async function submitExtractionJob(formData: FormData): Promise<JobItem> {
  const res = await fetch(`${API_BASE_URL}/api/jobs`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to submit extraction job");
  }
  return res.json();
}
