@echo off
REM ============================================================
REM  CarePulse one-click demo
REM  Brings up the FULL local stack (gateway + services + AI
REM  speech worker) and publishes it at a public HTTPS URL via a
REM  free Cloudflare quick tunnel. $0, no account, no card.
REM
REM  The public URL is printed in a banner below once the tunnel
REM  connects (https://<random>.trycloudflare.com). It changes on
REM  every run, and the link only works while this window is open.
REM ============================================================
cd /d "%~dp0"

REM --- 1. Docker Desktop (start it if the daemon isn't responding) ---
docker ps >nul 2>&1
if errorlevel 1 (
  echo Starting Docker Desktop ^(takes ~a minute on this machine^)...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  :waitdocker
  timeout /t 5 /nobreak >nul
  docker ps >nul 2>&1
  if errorlevel 1 goto waitdocker
)
echo Docker is up.

REM --- 2. Full containerized stack (gateway :8080 + 4 services + worker) ---
docker compose --profile containers up -d
if errorlevel 1 (
  echo docker compose failed - see output above.
  pause
  exit /b 1
)

REM --- 3. Frontend env for same-origin API through the gateway/tunnel ---
if not exist frontend\.env.local (
  echo VITE_API_URL=/api> frontend\.env.local
  echo VITE_DEMO_MODE=false>> frontend\.env.local
)

REM --- 4. Frontend dev server in its own window ---
start "CarePulse frontend" cmd /k "cd frontend && npm run dev"

REM --- 5. cloudflared (downloaded once, kept in tools\, not committed) ---
if not exist tools\cloudflared.exe (
  echo Downloading cloudflared...
  mkdir tools 2>nul
  curl -L -o tools\cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)

echo.
echo ============================================================
echo  Your PUBLIC URL appears in the box below:
echo     https://^<random-words^>.trycloudflare.com
echo  Share it while this window stays open.
echo  Press Ctrl+C (or close this window) to take the demo down.
echo ============================================================
echo.
tools\cloudflared.exe tunnel --url http://localhost:8080 --no-autoupdate
