@echo off
setlocal EnableDelayedExpansion

REM Disable Ctrl+C prompt
if "%1"=="CHILD" goto :CHILD
cmd /c ""%~f0" CHILD %*"
exit /b

:CHILD

REM Navigate to project root
cd /d "%~dp0.."

echo ==========================================
echo Installing 3D Printing Dashboard
echo ==========================================
echo.

REM Create .env from the example if it does not exist yet
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy /y ".env.example" ".env" >nul
    ) else (
        echo ERROR: .env.example not found. Cannot create .env.
        pause
        exit /b 1
    )
)

echo Checking required tools...
where node >nul 2>&1 || (echo ERROR: Node.js not found in PATH. & pause & exit /b 1)
where python >nul 2>&1 || (echo ERROR: Python not found in PATH. & pause & exit /b 1)
echo OK.

echo.
echo Installing Node.js dependencies...
cd frontend
call npm install
if !errorlevel! neq 0 (
    echo ERROR: npm install failed.
    cd ..
    pause
    exit /b 1
)
cd ..

if not exist "backend\venv" (
    echo.
    echo Creating Python virtual environment...
    python -m venv backend\venv
    if !errorlevel! neq 0 (
        echo ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo.
echo Installing Python dependencies...
call backend\venv\Scripts\python.exe -m pip install --upgrade pip
call backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if !errorlevel! neq 0 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Installation Complete!
echo ==========================================
echo.
echo To start the application, run:
echo   .\scripts\Run.bat
echo.
pause
