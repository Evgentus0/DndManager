@echo off
REM Quick release script - calls publish.ps1 with ZIP creation
SET VERSION=3.1.0

echo Publishing DndSessionManager v%VERSION%...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0publish.ps1" -Zip -Version %VERSION%

echo.
echo Press any key to close...
pause >nul
