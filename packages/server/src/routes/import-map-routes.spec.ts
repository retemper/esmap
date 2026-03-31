import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createImportMapRoutes } from './import-map-routes.js';
import type { ImportMap } from '@esmap/shared';
import { createEmptyImportMap } from '@esmap/shared';
import type { ImportMapStorage, DeploymentHistoryEntry } from '../storage/types.js';

/** In-memory storage for testing */
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

  /** Resets the storage state. */
  reset(): void {
    this.importMap = null;
    this.history = [];
  }
}

describe('import-map-routes', () => {
  const storage = new InMemoryStorage();
  const routes = createImportMapRoutes(storage);
  const app = new Hono().route('/api', routes);

  /** Scoped service name (includes / in URL) */
  const SERVICE = '@flex/checkout';

  beforeEach(() => {
    storage.reset();
  });

  describe('GET /api/', () => {
    it('returns an empty import map', async () => {
      const res = await app.request('/api');
      expect(res.status).toBe(200);

      const body = (await res.json()) as ImportMap;
      expect(body.imports).toStrictEqual({});
    });

    it('returns Content-Type as application/importmap+json', async () => {
      const res = await app.request('/api');
      expect(res.headers.get('Content-Type')).toContain('application/importmap+json');
    });

    it('returns Cache-Control as no-cache', async () => {
      const res = await app.request('/api');
      expect(res.headers.get('Cache-Control')).toContain('no-cache');
    });
  });

  describe('PATCH /api/services/:name', () => {
    it('registers an MFE URL', async () => {
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

    it('updates an existing URL', async () => {
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

    it('returns 400 when url is missing', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notUrl: 'value' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects javascript: protocol URLs', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'javascript:alert(1)' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects data: protocol URLs', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'data:text/javascript,alert(1)' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects malformed URLs', async () => {
      const res = await app.request(`/api/services/${SERVICE}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      });

      expect(res.status).toBe(400);
    });

    it('works with simple names without slashes', async () => {
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
    it('removes an MFE from the import map', async () => {
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
    it('returns deployment history', async () => {
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
    it('rolls back to the previous version', async () => {
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

    it('returns 404 when there is no history', async () => {
      const res = await app.request('/api/rollback/nonexistent', { method: 'POST' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/events', () => {
    it('returns an SSE response', async () => {
      const res = await app.request('/api/events');

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/event-stream');
      expect(res.headers.get('Cache-Control')).toBe('no-cache');
      expect(res.headers.get('Connection')).toBe('keep-alive');
    });

    it('broadcasts SSE event after PATCH', async () => {
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

  describe('prototype pollution defense', () => {
    const DANGEROUS_NAMES = ['__proto__', 'constructor', 'prototype'];

    DANGEROUS_NAMES.forEach((name) => {
      it(`rejects "${name}" service name in PATCH`, async () => {
        const res = await app.request(`/api/services/${name}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://evil.com/exploit.js' }),
        });

        expect(res.status).toBe(400);
      });

      it(`rejects "${name}" service name in DELETE`, async () => {
        const res = await app.request(`/api/services/${name}`, { method: 'DELETE' });

        expect(res.status).toBe(400);
      });

      it(`rejects "${name}" service name in rollback`, async () => {
        const res = await app.request(`/api/rollback/${name}`, { method: 'POST' });

        expect(res.status).toBe(400);
      });
    });
  });
});
