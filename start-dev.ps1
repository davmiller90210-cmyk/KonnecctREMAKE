$ErrorActionPreference = "Stop"

Write-Host "Starting KonnecctREMAKE Dev Environment" -ForegroundColor Green

# Start databases
Write-Host "`n1. Starting PostgreSQL & Redis..." -ForegroundColor Yellow
docker run -d --name dev-postgres -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=default -v postgres-dev-data:/var/lib/postgresql/data postgres:16
docker run -d --name dev-redis -p 6379:6379 redis:7-alpine

Write-Host "   Waiting for databases to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 8

# Set environment variables
$env:NODE_ENV = "development"
$env:PG_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/default"
$env:REDIS_URL = "redis://localhost:6379"
$env:SERVER_URL = "http://localhost:3000"
$env:APP_SECRET = "dev-secret-key"
$env:VITE_API_BASE_URL = "http://localhost:3000"

Write-Host "`n2. Starting Backend Server (localhost:3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $PSScriptRoot\packages\twenty-server; `$env:NODE_ENV='development'; `$env:PG_DATABASE_URL='postgres://postgres:postgres@localhost:5432/default'; `$env:REDIS_URL='redis://localhost:6379'; `$env:SERVER_URL='http://localhost:3000'; `$env:APP_SECRET='dev-secret-key'; npx nx start"

Write-Host "`n3. Starting Frontend Dev Server (localhost:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $PSScriptRoot\packages\twenty-front; `$env:VITE_API_BASE_URL='http://localhost:3000'; npx nx start"

Write-Host "`n✅ Environment started!" -ForegroundColor Green
Write-Host "`n📱 Access your app:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "`n💾 Database:" -ForegroundColor Cyan
Write-Host "   postgres://postgres:postgres@localhost:5432/default" -ForegroundColor Cyan
Write-Host "   Redis: localhost:6379" -ForegroundColor Cyan

Write-Host "`n⚠️  Both servers may take 30-60 seconds to start. Monitor output in their respective windows." -ForegroundColor Magenta
