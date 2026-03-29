/**
 * Import map 배포 서버.
 * @esmap/server의 Hono 라우트를 사용하여 import map을 제공하고,
 * SSE를 통해 실시간 배포 이벤트를 브로드캐스트한다.
 *
 * API:
 *   GET  /          — 현재 import map
 *   GET  /events    — SSE 스트림 (import-map-update, import-map-rollback)
 *   PATCH /services/:name — MFE 배포 (URL 갱신)
 *   POST /rollback/:name  — 이전 버전으로 롤백
 *   GET  /history   — 배포 이력
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
 * 지정된 포트를 점유 중인 프로세스를 종료한다.
 * 이전 dev 세션의 좀비 프로세스를 정리하여 EADDRINUSE를 방지한다.
 * @param port - 정리할 포트 번호
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
