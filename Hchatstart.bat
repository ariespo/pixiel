@echo off
chcp 65001 >/dev/null
echo =========================================
echo   Terminal Care - 启动器
echo =========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo 安装失败，请检查 Node.js 是否已安装
        pause
        exit /b 1
    )
)

echo 启动服务端和客户端...
echo.
npm start

pause
