@echo off
chcp 65001 >nul
echo ========================================
echo   臻品足道荣辱榜 - 一键启动
echo ========================================
echo.

echo [1/3] 启动后端服务器...
start "后端服务器" /min powershell -NoExit -Command "cd 'c:\Users\71486\Desktop\臻品足道荣辱榜'; node server/index.js"
timeout /t 3 /nobreak >nul

echo [2/3] 启动前端代理服务器...
start "前端代理" /min powershell -NoExit -Command "cd 'c:\Users\71486\Desktop\臻品足道荣辱榜'; node proxy-server.js"
timeout /t 3 /nobreak >nul

echo [3/3] 启动公网隧道...
start "公网隧道" /min cmd /k "npx localtunnel --port 3001"
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   启动完成!
echo.
echo   本地访问: http://localhost:3001
echo   公网地址: 请查看"公网隧道"窗口
echo.
echo   登录账号:
echo     管理员: admin / admin123
echo     查询员: boss1 / boss123
echo ========================================
echo.
echo 按任意键退出此窗口(服务继续运行)...
pause >nul
