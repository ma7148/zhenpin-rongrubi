@echo off
chcp 65001 >nul
echo ============================================
echo    臻品足道荣辱榜 - 公网启动脚本
echo ============================================
echo.

:: 1. 构建前端
echo [1/3] 构建前端...
call npx vite build
echo.

:: 2. 启动后端服务
echo [2/3] 启动后端服务...
start "荣辱榜-服务器" cmd /k "cd /d %~dp0 && node server/index.js"
timeout /t 3 /nobreak >nul

:: 3. 启动内网穿透
echo [3/3] 启动内网穿透...
echo.
echo ============================================
echo   系统已启动！分店访问地址：
echo   https://true-pots-call.loca.lt
echo.
echo   管理员账号: admin / admin123
echo ============================================
echo.
start "荣辱榜-穿透" cmd /k "cd /d %~dp0 && npx localtunnel --port 3003"
timeout /t 5 /nobreak >nul

:: 打开浏览器
start https://true-pots-call.loca.lt

echo 按任意键关闭所有窗口...
pause >nul

:: 关闭所有相关进程
taskkill /FI /WINDOWTITLE "荣辱榜-服务器*" >nul 2>&1
taskkill /FI /WINDOWTITLE "荣辱榜-穿透*" >nul 2>&1
echo 已关闭
