"""
UrbanFootprint AI - SQLite Database Persistence Layer
Lightweight, zero-external-dependency persistence for processing jobs, metadata, and reports.
"""

import sqlite3
import json
import os
import time
from typing import Dict, Any, List, Optional
from backend.app.core.config import settings


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables for persistent job management"""
    os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)
    conn = get_db_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                file_size_bytes INTEGER NOT NULL,
                mime_type TEXT,
                width INTEGER,
                height INTEGER,
                is_georeferenced INTEGER DEFAULT 0,
                crs_name TEXT,
                detected_buildings_count INTEGER DEFAULT 0,
                total_building_area REAL DEFAULT 0.0,
                area_unit TEXT DEFAULT 'pixels²',
                mean_confidence REAL DEFAULT 0.0,
                confidence_threshold REAL DEFAULT 0.5,
                tile_size INTEGER DEFAULT 512,
                tile_overlap INTEGER DEFAULT 64,
                min_polygon_area REAL DEFAULT 15.0,
                simplify_tolerance REAL DEFAULT 0.8,
                processing_time_seconds REAL DEFAULT 0.0,
                image_path TEXT,
                mask_path TEXT,
                prob_map_path TEXT,
                geojson_path TEXT,
                csv_path TEXT,
                zip_export_path TEXT,
                report_path TEXT,
                error_message TEXT,
                warnings TEXT,
                is_demo_mode INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
    conn.close()


# Ensure tables are initialized on import
init_db()


def create_job_record(job_data: Dict[str, Any]) -> str:
    conn = get_db_connection()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    with conn:
        conn.execute("""
            INSERT INTO jobs (
                id, status, original_filename, file_size_bytes, mime_type,
                width, height, is_georeferenced, crs_name, confidence_threshold,
                tile_size, tile_overlap, min_polygon_area, simplify_tolerance,
                image_path, is_demo_mode, warnings, created_at, updated_at
            ) VALUES (
                :id, :status, :original_filename, :file_size_bytes, :mime_type,
                :width, :height, :is_georeferenced, :crs_name, :confidence_threshold,
                :tile_size, :tile_overlap, :min_polygon_area, :simplify_tolerance,
                :image_path, :is_demo_mode, :warnings, :created_at, :updated_at
            )
        """, {
            "id": job_data["id"],
            "status": job_data.get("status", "pending"),
            "original_filename": job_data["original_filename"],
            "file_size_bytes": job_data.get("file_size_bytes", 0),
            "mime_type": job_data.get("mime_type", "image/png"),
            "width": job_data.get("width"),
            "height": job_data.get("height"),
            "is_georeferenced": 1 if job_data.get("is_georeferenced") else 0,
            "crs_name": job_data.get("crs_name"),
            "confidence_threshold": job_data.get("confidence_threshold", 0.5),
            "tile_size": job_data.get("tile_size", 512),
            "tile_overlap": job_data.get("tile_overlap", 64),
            "min_polygon_area": job_data.get("min_polygon_area", 15.0),
            "simplify_tolerance": job_data.get("simplify_tolerance", 0.8),
            "image_path": job_data.get("image_path"),
            "is_demo_mode": 1 if job_data.get("is_demo_mode") else 0,
            "warnings": json.dumps(job_data.get("warnings", [])),
            "created_at": now,
            "updated_at": now,
        })
    conn.close()
    return job_data["id"]


def update_job_record(job_id: str, updates: Dict[str, Any]):
    conn = get_db_connection()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    updates["updated_at"] = now
    if "warnings" in updates and isinstance(updates["warnings"], list):
        updates["warnings"] = json.dumps(updates["warnings"])

    fields = ", ".join(f"{k} = :{k}" for k in updates.keys())
    updates["id"] = job_id
    with conn:
        conn.execute(f"UPDATE jobs SET {fields} WHERE id = :id", updates)
    conn.close()


def get_job_by_id(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["is_georeferenced"] = bool(d["is_georeferenced"])
    d["is_demo_mode"] = bool(d["is_demo_mode"])
    try:
        d["warnings"] = json.loads(d["warnings"]) if d.get("warnings") else []
    except Exception:
        d["warnings"] = []
    return d


def list_jobs(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    conn.close()
    jobs = []
    for r in rows:
        d = dict(r)
        d["is_georeferenced"] = bool(d["is_georeferenced"])
        d["is_demo_mode"] = bool(d["is_demo_mode"])
        try:
            d["warnings"] = json.loads(d["warnings"]) if d.get("warnings") else []
        except Exception:
            d["warnings"] = []
        jobs.append(d)
    return jobs


def get_job_stats() -> Dict[str, Any]:
    """Returns honest statistics across all processed jobs without fabrication"""
    conn = get_db_connection()
    total_jobs = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    completed_jobs = conn.execute("SELECT COUNT(*) FROM jobs WHERE status = 'completed'").fetchone()[0]
    failed_jobs = conn.execute("SELECT COUNT(*) FROM jobs WHERE status = 'failed'").fetchone()[0]
    total_buildings = conn.execute("SELECT SUM(detected_buildings_count) FROM jobs WHERE status = 'completed'").fetchone()[0] or 0
    recent_job = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1").fetchone()
    conn.close()

    recent_dict = None
    if recent_job:
        recent_dict = dict(recent_job)
        recent_dict["is_georeferenced"] = bool(recent_dict["is_georeferenced"])

    return {
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "failed_jobs": failed_jobs,
        "total_buildings_detected": int(total_buildings),
        "recent_job": recent_dict,
    }
