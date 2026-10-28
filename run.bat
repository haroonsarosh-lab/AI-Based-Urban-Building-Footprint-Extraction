@echo off
REM ==============================================================================
REM UrbanFootprint AI - Unified Windows Service Launcher
REM Launches FastAPI Backend (Port 8000) and Next.js Frontend (Port 3000)
REM ==============================================================================

echo ==============================================================================
echo   UrbanFootprint AI - Building Footprint Extraction (SIH 2026 P24)
echo ==============================================================================
echo [*] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "UrbanFootprint Backend (FastAPI)" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [*] Starting Next.js Frontend on http://localhost:3000 ...
cd frontend
start "UrbanFootprint Frontend (Next.js)" cmd /k "npm run dev"
cd ..

echo.
echo [OK] Both services launched successfully in separate terminal windows!
echo   - Backend API & Swagger Docs: http://127.0.0.1:8000/api/docs
echo   - Frontend GIS Dashboard:    http://localhost:3000
echo.
echo Press any key to stop instructions.
pause >nul
