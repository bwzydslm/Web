@echo off
chcp 65001 >nul
title 本地开发 - 个人网站 (Vite)

rem ============================================================
rem  站已改为 Vite + Vue 单页应用，本地预览需要用 Vite 的 dev server。
rem  它提供热更新，并且会把 /api 转发到线上，所以接口也能在本地调。
rem
rem  前提：需要安装 Node.js（https://nodejs.org/ ，选 LTS 版即可）。
rem ============================================================

cd /d "%~dp0"

set URL=http://127.0.0.1:5173/

where node >nul 2>nul
if not %errorlevel%==0 (
    echo.
    echo   [x] 没有找到 Node.js，无法启动开发服务器。
    echo.
    echo   安装地址：https://nodejs.org/  （下载 LTS 版，一路下一步）
    echo   装完关掉这个窗口重新双击即可。
    echo.
    echo   临时替代方案：先执行一次 npm run build，
    echo   然后把 dist 目录用任意静态服务器托管。
    echo.
    pause
    exit /b 1
)

echo.
echo   项目目录：%CD%
echo   预览地址：%URL%
echo   关闭这个窗口即停止服务器。
echo ------------------------------------------------------------
echo.

rem 延迟 3 秒再打开浏览器：Vite 起服务要一两秒，
rem 先开浏览器会直接撞上 ERR_CONNECTION_REFUSED。
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process '%URL%'"

call npm run dev
