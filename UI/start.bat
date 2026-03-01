@echo off
echo ========================================
echo    WMPFDebugger 微信小程序调试器
echo ========================================
echo.
echo 功能特性：
echo 1. 实时运行日志显示
echo 2. 自动检测微信小程序启动
echo 3. 检测后立即打开控制台
echo 4. 支持多小程序自动识别
echo.
echo 请确保已安装：
echo   - Node.js (v14+)
echo   - npm
echo   - 微信桌面版已安装
echo.
echo ========================================
echo.

cd /d "%~dp0.."
echo 检查项目依赖...
if not exist node_modules (
    echo 正在安装依赖...
    npm install
) else (
    echo 依赖已安装
)

echo.
echo 正在编译项目...
npm run build

echo.
echo ========================================
echo 启动 Electron 应用...
echo 注意：启动后请打开微信并启动小程序
echo 系统会自动检测并打开控制台
echo ========================================
echo.
npm start

echo.
echo 应用已关闭
pause