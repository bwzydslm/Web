@echo off
chcp 65001 >nul
title 本地预览 - 个人网站

rem ============================================================
rem  双击本文件即可在浏览器里预览本站
rem  原理：把「本文件所在的文件夹」当成网站根目录起一个本地服务器
rem  这样 assets/css、assets/js 这些相对路径才能正确加载
rem ============================================================

rem 切到脚本所在目录（也就是项目根目录），关键的一步
cd /d "%~dp0"

set PORT=5173
set URL=http://127.0.0.1:%PORT%/

echo.
echo   项目目录：%CD%
echo   预览地址：%URL%
echo.
echo   关闭这个黑窗口即可停止服务器。
echo ------------------------------------------------------------
echo.

rem 优先用 py 启动器，没有再用 python
where py >nul 2>nul
if %errorlevel%==0 (
    start "" "%URL%"
    py -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
    start "" "%URL%"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

echo   [!] 没有找到 Python，无法启动本地服务器。
echo.
echo   替代方案（任选其一）：
echo     1) 直接双击 index.html 用浏览器打开（file:// 方式，本站也能正常显示）
echo     2) 安装 Python：https://www.python.org/downloads/
echo     3) 装了 Node.js 的话，在本目录执行： npx serve .
echo.
pause

:end
