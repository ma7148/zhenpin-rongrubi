@echo off
chcp 65001 >nul
echo ============================================
echo    臻品足道荣辱榜 - 本地启动脚本
echo ============================================
echo.

:: 1. 启动后端服务
echo [1/2] 启动后端服务...
start "荣辱榜-服务器" cmd /k "cd /d %~dp0 && node server/index.js"
timeout /t 2 /nobreak >nul

:: 2. 启动前端开发服务器
echo [2/2] 启动前端...
start "荣辱榜-前端" cmd /k "cd /d %~dp0 && npx vite --port 5173"
timeout /t 3 /nobreak >nul

:: 打开浏览器
start http://localhost:5173

echo.
echo ============================================
echo   本地访问地址: http://localhost:5173
echo   管理员账号: admin / admin123
echo ============================================
echo.
echo 按任意键关闭所有窗口...
pause >nul

taskkill /FI /WINDOWTITLE "荣辱榜-服务器*" >nul 2>&1
taskkill /FI /WINDOWTITLE "荣辱榜-前端*" >nul 2>&1
echo 已关闭
