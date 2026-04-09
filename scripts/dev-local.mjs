/**
 * Cross-platform dev server: Nest (3000) + Vite HMR (3001) + worker after API is up.
 * Avoids shell-specific quoting issues (Windows cmd/PowerShell vs bash).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const proc = spawn(
  'npx',
  [
    'concurrently',
    '--kill-others',
    '-n',
    'server,front,worker',
    'nx run twenty-server:start',
    'nx run twenty-front:start',
    'wait-on tcp:3000 && nx run twenty-server:worker',
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    // Needed so `wait-on … && nx …` runs in a shell (Windows + Unix).
    shell: true,
    env: process.env,
  },
);

proc.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});
