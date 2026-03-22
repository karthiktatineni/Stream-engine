@echo off
setlocal
title StreamEngine Backend + Tunnel

echo [1/2] Starting Backend Server...
start "Backend" cmd /c "npm run dev:backend"

echo [2/2] Starting Cloudflare Tunnel...
echo Using config from C:\Users\karth\.cloudflared\config.yml
start "Tunnel" cmd /c "cloudflared tunnel --config C:\Users\karth\.cloudflared\config.yml run c703530a-2007-4f67-8625-f3769c9b1318"

echo.
echo ======================================================
echo Backend and Tunnel are launching in separate windows.
echo Frontend should be reachable at your custom domain.
echo ======================================================
pause
