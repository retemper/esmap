import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createImportMapRoutes } from './import-map-routes.js';
import type { ImportMap } from '@esmap/shared';
import { createEmptyImportMap } from '@esmap/shared';
import type { ImportMapStorage, DeploymentHistoryEntry } from '../storage/types.js';

/** 인메모리 테스트용 저장소 */
class InMemoryStorage implements ImportMapStorage {
  private importMap: ImportMap | null = null;
  private history: DeploymentHistoryEntry[] = [];

  async read(): Promise<ImportMap | null> {
    return this.importMap;
  }

  async update(updater: (current: ImportMap) => ImportMap): Promise<ImportMap> {
    const current = this.importMap ?? createEmptyImportMap();
    this.importMap = updater(current);
    return this.importMap;
  }

  async appendHistory(entry: DeploymentHistoryEntry): Promise<void> {
    this.history.unshift(entry);
  }

  async getHistory(limit = 50): Promise<readonly DeploymentHistoryEntry[]> {
    return this.history.slice(0, limit);
  }

  /** 저장소 상태를 리셋한다. */
  reset(): void {
    this.importMap = null;
    this.history = [];
  }
}

describe('import-map-routes', () => {
  const storage = new InMemoryStorage();
  const routes = createImportMapRoutes(storage);
  const app = new Hono().route('/api', routes);

  /** scoped 서비스 이름 (URL에서 / 포함) */
  const SERVICE = '@flex/checkout';

  beforeEach(() => {
    storage.reset();
  });

  describe('GET /api/', () => {
    it('빈 import map을 반환한다', async () => {
      const res = await app.request('/api');
      expect(res.status).toBe(200);

      const body = (await res.json()) as ImportMap;
      expect(body.imports).toStrictEqual({});
    });

    it('Content-Type이 application/importmap+json이다', async () => {
      const res = await app.request('/api');
      expect(res.headers.get('Content-Type')).toContain('application/importmap+json');
    });

    it('Cache-Control이 no-cache다', async () => {
      const res = await app.request('/api');
      expect(res.headers.get('Cache-Control')).toContain('no-cache');
    });
  });

  describe('PATCH /api/services/:name', () => {
    it('MFE URL을 등록한다', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout-abc.js' }),
      });

      expect(res.status).toBe(200);

      const body = (await res.json()) as { service: string; url: string; importMap: ImportMap };
      expect(body.service).toBe(SERVICE);
      expect(body.importMap.imports[SERVICE]).toBe('https://cdn.example.com/checkout-abc.js');
    });

    it('기존 URL을 갱신한다', async () => {
      await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout-v1.js' }),
      });

      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout-v2.js' }),
      });

      const body = (await res.json()) as { importMap: ImportMap };
      expect(body.importMap.imports[SERVICE]).toBe('https://cdn.example.com/checkout-v2.js');
    });

    it('url이 없으면 400을 반환한다', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notUrl: 'value' }),
      });

      expect(res.status).toBe(400);
    });

    it('javascript: 프로토콜 URL을 거부한다', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'javascript:alert(1)' }),
      });

      expect(res.status).toBe(400);
    });

    it('data: 프로토콜 URL을 거부한다', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'data:text/javascript,alert(1)' }),
      });

      expect(res.status).toBe(400);
    });

    it('잘못된 URL 형식을 거부한다', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      });

      expect(res.status).toBe(400);
    });

    it('슬래시 없는 단순 이름도 동작한다', async () => {
      const res = await app.request('/api/services/react', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/react.js' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { importMap: ImportMap };
      expect(body.importMap.imports['react']).toBe('https://cdn.example.com/react.js');
    });
  });

  describe('DELETE /api/services/:name', () => {
    it('MFE를 import map에서 제거한다', async () => {
      await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout.js' }),
      });

      const res = await app.request(`/api/services/${SERVICE}`, { method: 'DELETE' });

      expect(res.status).toBe(200);

      const body = (await res.json()) as { importMap: ImportMap };
      expect(body.importMap.imports[SERVICE]).toBeUndefined();
    });
  });

  describe('GET /api/history', () => {
    it('배포 이력을 반환한다', async () => {
      await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout.js' }),
      });

      const res = await app.request('/api/history');
      expect(res.status).toBe(200);

      const history = (await res.json()) as DeploymentHistoryEntry[];
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].service).toBe(SERVICE);
    });
  });

  describe('POST /api/rollback/:name', () => {
    it('이전 버전으로 롤백한다', async () => {
      await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout-v1.js' }),
      });

      await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout-v2.js' }),
      });

      const res = await app.request(`/api/rollback/${SERVICE}`, { method: 'POST' });

      expect(res.status).toBe(200);

      const body = (await res.json()) as { rolledBackTo: string; importMap: ImportMap };
      expect(body.importMap.imports[SERVICE]).toBe('https://cdn.example.com/checkout-v1.js');
    });

    it('이력이 없으면 404를 반환한다', async () => {
      const res = await app.request('/api/rollback/nonexistent', { method: 'POST' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/events', () => {
    it('SSE 응답을 반환한다', async () => {
      const res = await app.request('/api/events');

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream');
      expect(res.headers.get('Cache-Control')).toBe('no-cache');
      expect(res.headers.get('Connection')).toBe('keep-alive');
    });

    it('PATCH 후 SSE 이벤트가 브로드캐스트된다', async () => {
      const sseRes = await app.request('/api/events');
      const reader = sseRes.body!.getReader();

      await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/checkout-sse.js' }),
      });

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain('event: import-map-update');
      expect(text).toContain('"service":"@flex/checkout"');
      expect(text).toContain('"url":"https://cdn.example.com/checkout-sse.js"');

      reader.releaseLock();
    });
  });

  describe('프로토타입 오염 방어', () => {
    const DANGEROUS_NAMES = ['__proto__', 'constructor', 'prototype'];

    DANGEROUS_NAMES.forEach((name) => {
      it(`PATCH에서 "${name}" 서비스 이름을 거부한다`, async () => {
        const res = await app.request(`/api/services/${name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://evil.com/exploit.js' }),
        });

        expect(res.status).toBe(400);
      });

      it(`DELETE에서 "${name}" 서비스 이름을 거부한다`, async () => {
        const res = await app.request(`/api/services/${name}`, { method: 'DELETE' });

        expect(res.status).toBe(400);
      });

      it(`rollback에서 "${name}" 서비스 이름을 거부한다`, async () => {
        const res = await app.request(`/api/rollback/${name}`, { method: 'POST' });

        expect(res.status).toBe(400);
      });
    });
  });
});
