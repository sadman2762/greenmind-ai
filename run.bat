@echo off
setlocal enabledelayedexpansion
title GreenMind AI Launcher

echo ===================================================
echo             GreenMind AI Launcher
echo ===================================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

:: Check Backend Environment
if not exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
    echo [WARNING] Python virtual environment not found at %BACKEND_DIR%\.venv
    echo Please make sure backend dependencies are installed.
    pause
    exit /b 1
)

:: Check Frontend Node Modules
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [INFO] node_modules not found in frontend. Running npm install...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo [1/3] Starting Backend API server (FastAPI on http://127.0.0.1:8000)...
start "GreenMind AI - Backend" cmd /k "cd /d "%BACKEND_DIR%" && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo [2/3] Starting Frontend Dev server (Vite on http://localhost:5173)...
start "GreenMind AI - Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:5173/

echo.
echo ===================================================
echo  GreenMind AI is running!
echo  - Frontend: http://localhost:5173/
echo  - Backend:  http://127.0.0.1:8000/
echo  - API Docs: http://127.0.0.1:8000/docs
echo.
echo  Keep the opened terminal windows running.
echo  To stop the application, close the terminal windows.
echo ===================================================
echo.

pause
