@echo off
title MAH POS - Local Server
echo ================================================================
echo       MEMBUKA MAH POS DI BROWSER LOKAL (HTTP)
echo ================================================================
echo.

:: Bersihkan port 3000 jika ada proses tertinggal
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

cd /d "%~dp0"
node server.js
pause

