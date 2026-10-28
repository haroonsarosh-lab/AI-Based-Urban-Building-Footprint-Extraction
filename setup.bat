@echo off
REM ==============================================================================
REM UrbanFootprint AI - Windows Automated Setup Script
REM SIH 2026 Problem P24: AI-Based Urban Building Footprint Extraction
REM ==============================================================================

echo [*] Initializing UrbanFootprint AI Environment Setup...

REM 1. Verify Python Installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python is not installed or not in PATH. Please install Python 3.11+.
    pause
    exit /b 1
)

REM 2. Create Python Virtual Environment
if not exist .venv (
    echo [*] Creating virtual environment (.venv)...
    python -m venv .venv
) else (
    echo [*] Virtual environment .venv already exists.
)

REM 3. Upgrade pip and install backend dependencies
echo [*] Installing backend dependencies...
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\pip.exe install -r backend/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

REM 4. Initialize Node.js dependencies for frontend
echo [*] Installing frontend dependencies...
cd frontend
call npm install
cd ..

REM 5. Train Synthetic Verification Checkpoint if none exists
if not exist data\checkpoints\urban_unet_best.pt (
    echo [*] Generating synthetic verification model checkpoint...
    .venv\Scripts\python.exe -m ml.train --synthetic --epochs 3 --batch-size 2
)

echo.
echo [OK] Setup completed successfully!
echo [!] You can now start the application by running run.bat
echo.
pause
