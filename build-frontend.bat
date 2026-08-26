@echo off
cd /d "%~dp0"
echo Building frontend...
npx vite build
echo Build complete!
pause
