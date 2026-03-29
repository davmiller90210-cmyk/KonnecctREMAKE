$env:NODE_ENV = "development"
$env:PG_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/default"
$env:REDIS_URL = "redis://localhost:6379"
$env:SERVER_URL = "http://localhost:3000"
$env:APP_SECRET = "dev-secret-key-12345"
$env:VITE_API_BASE_URL = "http://localhost:3000"

Write-Host "Starting Konnecct Dev Environment..." -ForegroundColor Green
Write-Host ""
Write-Host "Terminal 1: Backend Server (Port 3000)" -ForegroundColor Cyan
Write-Host "Terminal 2: Frontend Dev Server (Port 5173)" -ForegroundColor Cyan
Write-Host ""

# Start backend in new window
$backendScript = {
    cd $args[0]
    yarn start
}

# Start frontend in new window  
$frontendScript = {
    cd $args[0]
    yarn start
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd/packages/twenty-server'; yarn start" -WindowStyle Normal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$pwd/packages/twenty-front'; yarn start" -WindowStyle Normal

Write-Host ""
Write-Host "Servers starting in new windows..." -ForegroundColor Yellow
Write-Host "Wait 30-60 seconds, then open:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  (Frontend proxies to backend on 3000)" -ForegroundColor Cyan
