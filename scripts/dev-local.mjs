/**
 * Cross-platform dev server: Nest (3000) + Vite HMR (3001) + worker after API is up.
 * Windows: use one shell string — spawn(npx, [array], { shell: true }) breaks `nx run …`.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = { ...process.env };
if (!/\bmax-old-space-size=/.test(env.NODE_OPTIONS ?? '')) {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, '--max-old-space-size=8192']
    .filter(Boolean)
    .join(' ')
    .trim();
}

const command = [
  'npx concurrently --kill-others -n server,front,worker',
  '"npx nx run twenty-server:start"',
  '"npx nx run twenty-front:start"',
  '"npx wait-on tcp:3000 && npx nx run twenty-server:worker"',
].join(' ');

const proc = spawn(command, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
  env,
});

proc.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 1);
});
