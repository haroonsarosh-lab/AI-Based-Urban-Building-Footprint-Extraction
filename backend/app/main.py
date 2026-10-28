"""
UrbanFootprint AI - FastAPI Application Entry Point
SIH 2026 Problem P24: AI-Based Urban Building Footprint Extraction
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.app.core.config import settings
from backend.app.db.database import init_db
from backend.app.api.endpoints import router

app = FastAPI(
    title=settings.app_name,
    description=settings.app_subtitle,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints
app.include_router(router)


@app.on_event("startup")
def on_startup():
    """Initializes tables and dependencies on startup"""
    init_db()


@app.get("/")
def root():
    return {
        "app_name": settings.app_name,
        "subtitle": settings.app_subtitle,
        "version": settings.app_version,
        "status": "online",
        "documentation": "/api/docs",
        "api_endpoints": {
            "health": "/api/health",
            "model_info": "/api/model/info",
            "dashboard_stats": "/api/stats",
            "jobs": "/api/jobs",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.host, port=settings.port, reload=True)
