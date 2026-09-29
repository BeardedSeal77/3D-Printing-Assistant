@echo off
setlocal EnableDelayedExpansion

REM Disable Ctrl+C prompt
if "%1"=="CHILD" goto :CHILD
cmd /c ""%~f0" CHILD %*"
exit /b

:CHILD

REM Navigate to project root
cd /d "%~dp0.."

REM Check .env exists
if not exist ".env" (
    echo ERROR: .env not found.
    echo Run .\scripts\Install.bat first, or copy .env.example to .env
    echo.
    pause
    exit /b 1
)

REM Read settings from .env (defaults match .env.example)
set FLASK_PORT=5328
set DEV_LOG=false
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /r "^[A-Z_]*=" .env`) do (
    if /i "%%a"=="FLASK_PORT" set FLASK_PORT=%%b
    if /i "%%a"=="DEV_LOG"    set DEV_LOG=%%b
)

echo ==========================================
echo Starting 3D Printing Dashboard
echo ==========================================
echo.
echo Next.js Frontend: http://localhost:3000
echo Flask API:        http://localhost:!FLASK_PORT!
echo Data:             data\materials\*.json, data\inventory.json
echo.
echo ==========================================

echo.
if /i "!DEV_LOG!"=="true" (
    echo Starting Next.js and Flask with logging to temp\dev.log...
) else (
    echo Starting Next.js and Flask...
)
echo.

cd frontend

echo Clearing Next.js cache...
if exist ".next" rmdir /s /q ".next" >nul 2>&1

call npm run dev

cd ..
echo.
echo All services stopped.
pause
exit /b
