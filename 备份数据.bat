@echo off
chcp 65001 >nul
echo ========================================
echo   ??????? - ????
echo ========================================
echo.

cd /d "%~dp0"

echo ??????...
node scripts/backup-all.cjs

echo.
echo ??????...
pause >nul
