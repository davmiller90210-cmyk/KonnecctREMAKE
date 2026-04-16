@echo off
REM Development workflow for Twenty CRM with live preview

echo Starting infrastructure...
docker compose -f docker-compose.dev.yml up -d

REM Wait for services to be healthy
echo Waiting for services to be healthy...
timeout /t 5 /nobreak

REM Check if node modules exist, if not install
if not exist "node_modules" (
  echo Installing dependencies...
  call yarn install
)

REM Start both frontend and backend in parallel with hot reload
echo.
echo Starting development servers with hot reload...
echo.
echo Frontend will be available at: http://localhost:5173
echo Backend API will be available at: http://localhost:3000
echo.
echo Make code changes in Cursor and they will automatically reload!
echo.

call yarn dev
