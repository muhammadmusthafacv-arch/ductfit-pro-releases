@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo        DUCTFIT PRO - ONE-CLICK RELEASE PUBLISHER
echo ==========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-release.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Release publishing failed. See messages above.
    pause
    exit /b %errorlevel%
)
