/**
 * Import map deployment server.
 * Uses @esmap/server's Hono routes to serve the import map and
 * broadcasts real-time deployment events via SSE.
 *
 * API:
 *   GET  /          — current import map
 *   GET  /events    — SSE stream (import-map-update, import-map-rollback)
 *   PATCH /services/:name — MFE deployment (URL update)
 *   POST /rollback/:name  — rollback to previous version
 *   GET  /history   — deployment history
 */
import { serve } from '@hono/node-server';
import { execSync } from 'node:child_process';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createImportMapRoutes } from '@esmap/server';
import { FileSystemStorage } from '@esmap/server';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../data');

const storage = new FileSystemStorage(DATA_DIR);
const importMapRoutes = createImportMapRoutes(storage);

const app = new Hono();
app.use('/*', cors());
app.route('/', importMapRoutes);

const PORT = 3200;

/**
 * Kills processes occupying the specified port.
 * Cleans up zombie processes from previous dev sessions to prevent EADDRINUSE.
 * @param port - the port number to clean up
 */
function killPortProcess(port: number): void {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
    if (pids) {
      const currentPid = process.pid.toString();
      const otherPids = pids.split('\n').filter((pid) => pid !== currentPid);
      if (otherPids.length > 0) {
        execSync(`kill -9 ${otherPids.join(' ')}`, { encoding: 'utf-8' });
        console.log(`[platform-server] Killed stale process(es) on port ${port}: ${otherPids.join(', ')}`);
      }
    }
  } catch {
    // lsof returns exit code 1 when no process found — expected
  }
}

killPortProcess(PORT);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[platform-server] Import map server running at http://localhost:${PORT}`);
  console.log(`[platform-server] SSE endpoint: http://localhost:${PORT}/events`);
  console.log(`[platform-server] Deploy: PATCH http://localhost:${PORT}/services/{name}`);
});
