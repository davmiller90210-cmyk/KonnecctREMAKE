# Local Development Workflow with Live Preview

This setup enables live code editing in Cursor with instant preview updates.

## Quick Start

### Windows (PowerShell)
```powershell
.\dev.bat
```

### macOS / Linux
```bash
./dev.sh
chmod +x dev.sh  # First time only
```

## What Happens

1. **Docker Compose** starts PostgreSQL and Redis services in the background
2. **Node.js dev servers** start with hot reload enabled for both frontend and backend
3. Changes you make in Cursor automatically trigger recompilation and reload

## URL References

- **Frontend** (React Vite): http://localhost:5173
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432 (postgres:postgres)
- **Redis**: localhost:6379

## File Watching & Hot Reload

- `packages/twenty-front/src` → Frontend (Vite) auto-refreshes on save
- `packages/twenty-server/src` → Backend (NestJS) auto-restarts on save
- `packages/twenty-ui/src` → Shared UI components hot reload
- `packages/twenty-shared/src` → Shared utilities hot reload

## Stopping Development

Press `Ctrl+C` in the terminal to stop both dev servers. The database and Redis will keep running.

## Clean Up

To stop all services (including database):
```bash
docker compose -f docker-compose.dev.yml down
```

To remove volumes and start fresh:
```bash
docker compose -f docker-compose.dev.yml down -v
```

## Troubleshooting

**Port already in use?**
- Port 5173 (frontend): Change in `packages/twenty-front/vite.config.ts`
- Port 3000 (backend): Change in `packages/twenty-server` environment
- Port 5432 (database): Edit `docker-compose.dev.yml` port mapping
- Port 6379 (redis): Edit `docker-compose.dev.yml` port mapping

**Changes not showing up?**
- Check browser console for errors (F12 → Console)
- Verify file changes are saved in Cursor
- Check terminal output for compilation errors

**Need fresh database?**
```bash
docker compose -f docker-compose.dev.yml down -v
```

This removes all volumes, so the database will reinitialize on next start.
