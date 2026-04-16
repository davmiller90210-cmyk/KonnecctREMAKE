#!/bin/bash
# Development workflow for Twenty CRM with live preview

# Start infrastructure (database, redis)
echo "Starting infrastructure..."
docker compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "Waiting for services to be healthy..."
sleep 5

# Check if node modules exist, if not install
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  yarn install
fi

# Start both frontend and backend in parallel with hot reload
echo "Starting development servers with hot reload..."
echo ""
echo "Frontend will be available at: http://localhost:5173"
echo "Backend API will be available at: http://localhost:3000"
echo ""
echo "Make code changes in Cursor and they will automatically reload!"
echo ""

# Use concurrently if available, otherwise start in background
yarn dev
