@echo off
setlocal enabledelayedexpansion

echo.
echo Starting KonnecctREMAKE Dev Environment
echo.

echo 1. Starting PostgreSQL ^& Redis...
docker run -d --name dev-postgres -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=default -v postgres-dev-data:/var/lib/postgresql/data postgres:16
docker run -d --name dev-redis -p 6379:6379 redis:7-alpine

echo    Waiting 8 seconds for databases...
timeout /t 8 /nobreak

echo.
echo 2. Starting Backend (3000) and Frontend (5173) servers...
echo    Launching in new windows - please wait 30-60 seconds for startup messages...
echo.

set NODE_ENV=development
set PG_DATABASE_URL=postgres://postgres:postgres@localhost:5432/default
set REDIS_URL=redis://localhost:6379
set SERVER_URL=http://localhost:3000
set APP_SECRET=dev-secret-key
set VITE_API_BASE_URL=http://localhost:3000

start "Backend - Port 3000" cmd /k "cd packages\twenty-server && npx nx start"
start "Frontend - Port 5173" cmd /k "cd packages\twenty-front && npx nx start"

echo.
echo READY:
echo ============================================
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo Database: postgres://postgres:postgres@localhost:5432/default
echo Redis:    localhost:6379
echo ============================================
echo.
echo Check the newly opened windows for startup messages.
