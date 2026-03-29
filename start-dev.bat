@echo off
setlocal enabledelayedexpansion

echo Setting up Konnecct Dev Environment
echo.

echo Step 1: Waiting for databases...
timeout /t 5 /nobreak

echo.
echo Step 2: Starting backend server on port 3000...
start "Konnecct Backend" cmd /k "cd packages\twenty-server && yarn start"

echo.
echo Step 3: Starting frontend dev server on port 5173...
start "Konnecct Frontend" cmd /k "cd packages\twenty-front && yarn start"

echo.
echo ============================================
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo ============================================
echo.
echo Both servers are starting in separate windows.
echo Wait 30-60 seconds for them to be ready, then open your browser.
echo.
pause
