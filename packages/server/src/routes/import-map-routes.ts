import { Hono } from 'hono';
import type { ImportMapStorage, DeploymentHistoryEntry } from '../storage/types.js';
import { createEmptyImportMap, mergeImportMaps } from '@esmap/shared';
import type { ImportMap } from '@esmap/shared';
import { createEventStream } from '../sse/event-stream.js';

/** 배포 요청 본문 */
interface DeployRequest {
  readonly url: string;
  readonly deployedBy?: string;
}

/**
 * Import map 서빙 및 배포 API 라우트를 생성한다.
 * @param storage - import map 저장소 구현체
 */
export function createImportMapRoutes(storage: ImportMapStorage): Hono {
  const app = new Hono();
  const eventStream = createEventStream();

  /** GET / — 현재 import map JSON을 반환한다. */
  app.get('/', async (c) => {
    const importMap = (await storage.read()) ?? createEmptyImportMap();

    return c.json(importMap, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/importmap+json',
    });
  });

  /** GET /events — SSE 스트림을 통해 import map 변경 이벤트를 실시간으로 전달한다. */
  app.get('/events', (_c) => {
    const stream = eventStream.connect();
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  });

  /** PATCH /services/:name{.+} — 특정 MFE의 URL을 갱신한다. 이름에 /가 포함될 수 있다. */
  app.patch('/services/:name{.+}', async (c) => {
    const serviceName = decodeURIComponent(c.req.param('name'));

    if (!isValidServiceName(serviceName)) {
      return c.json({ error: `잘못된 서비스 이름: "${serviceName}"` }, 400);
    }

    const body: unknown = await c.req.json();

    if (!isDeployRequest(body)) {
      return c.json({ error: '"url" 필드는 필수입니다' }, 400);
    }

    const currentMap = (await storage.read()) ?? createEmptyImportMap();
    const previousUrl = currentMap.imports[serviceName] ?? '';

    const updated = await storage.update((current) => {
      const overlay: ImportMap = {
        imports: { [serviceName]: body.url },
      };
      return mergeImportMaps(current, overlay, 'override');
    });

    const historyEntry: DeploymentHistoryEntry = {
      timestamp: new Date().toISOString(),
      service: serviceName,
      previousUrl,
      newUrl: body.url,
      deployedBy: body.deployedBy,
    };
    await storage.appendHistory(historyEntry);

    eventStream.broadcast({
      type: 'import-map-update',
      data: JSON.stringify({ service: serviceName, url: body.url, importMap: updated }),
    });

    return c.json({
      service: serviceName,
      url: body.url,
      importMap: updated,
    });
  });

  /** DELETE /services/:name{.+} — 특정 MFE를 import map에서 제거한다. */
  app.delete('/services/:name{.+}', async (c) => {
    const serviceName = decodeURIComponent(c.req.param('name'));

    if (!isValidServiceName(serviceName)) {
      return c.json({ error: `잘못된 서비스 이름: "${serviceName}"` }, 400);
    }

    const updated = await storage.update((current) => {
      const { [serviceName]: _, ...rest } = current.imports;
      return { ...current, imports: rest };
    });

    eventStream.broadcast({
      type: 'import-map-update',
      data: JSON.stringify({ service: serviceName, removed: true, importMap: updated }),
    });

    return c.json({ service: serviceName, removed: true, importMap: updated });
  });

  /** GET /history — 배포 이력을 조회한다. */
  app.get('/history', async (c) => {
    const limitParam = c.req.query('limit');
    const parsed = limitParam ? Number(limitParam) : NaN;
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 1000) : 50;
    const history = await storage.getHistory(limit);
    return c.json(history);
  });

  /** POST /rollback/:name{.+} — 특정 MFE를 이전 버전으로 롤백한다. */
  app.post('/rollback/:name{.+}', async (c) => {
    const serviceName = decodeURIComponent(c.req.param('name'));

    if (!isValidServiceName(serviceName)) {
      return c.json({ error: `잘못된 서비스 이름: "${serviceName}"` }, 400);
    }

    const history = await storage.getHistory(100);
    const lastDeploy = history.find((h) => h.service === serviceName && h.previousUrl);

    if (!lastDeploy) {
      return c.json({ error: `"${serviceName}"의 롤백 대상 이력이 없습니다` }, 404);
    }

    const updated = await storage.update((current) => {
      const overlay: ImportMap = {
        imports: { [serviceName]: lastDeploy.previousUrl },
      };
      return mergeImportMaps(current, overlay, 'override');
    });

    await storage.appendHistory({
      timestamp: new Date().toISOString(),
      service: serviceName,
      previousUrl: lastDeploy.newUrl,
      newUrl: lastDeploy.previousUrl,
      deployedBy: 'rollback',
    });

    eventStream.broadcast({
      type: 'import-map-rollback',
      data: JSON.stringify({
        service: serviceName,
        rolledBackTo: lastDeploy.previousUrl,
        importMap: updated,
      }),
    });

    return c.json({
      service: serviceName,
      rolledBackTo: lastDeploy.previousUrl,
      importMap: updated,
    });
  });

  return app;
}

/** 프로토타입 오염을 유발하는 위험한 프로퍼티 이름 집합 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * 서비스 이름이 안전한지 검증한다.
 * 프로토타입 오염을 유발하는 키와 빈 문자열을 거부한다.
 * @param name - 검증할 서비스 이름
 */
function isValidServiceName(name: string): boolean {
  return name.length > 0 && !DANGEROUS_KEYS.has(name);
}

/**
 * 배포 요청 본문이 유효한지 검증한다.
 * url 필드가 문자열이고 http(s) 프로토콜인지 확인한다.
 */
function isDeployRequest(body: unknown): body is DeployRequest {
  if (typeof body !== 'object' || body === null || !('url' in body) || typeof body.url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(body.url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
