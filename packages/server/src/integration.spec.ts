import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createImportMapRoutes } from './routes/import-map-routes.js';
import type { ImportMapStorage, DeploymentHistoryEntry } from './storage/types.js';
import type { ImportMap } from '@esmap/shared';

/** 테스트용 인메모리 스토리지 */
class InMemoryStorage implements ImportMapStorage {
  private data: ImportMap = { imports: {} };
  private history: DeploymentHistoryEntry[] = [];

  async read(): Promise<ImportMap> {
    return structuredClone(this.data);
  }

  async update(fn: (current: ImportMap) => ImportMap): Promise<ImportMap> {
    this.data = fn(structuredClone(this.data));
    return structuredClone(this.data);
  }

  async getHistory(): Promise<readonly DeploymentHistoryEntry[]> {
    return [...this.history];
  }

  async appendHistory(entry: DeploymentHistoryEntry): Promise<void> {
    this.history.unshift(entry);
  }
}

/**
 * 서버 API 통합 테스트.
 * 배포 → 조회 → 롤백의 전체 플로우를 검증한다.
 */
describe('서버 API 통합 테스트', () => {
  const createApp = () => {
    const storage = new InMemoryStorage();
    const routes = createImportMapRoutes(storage);
    const app = new Hono().route('/api', routes);
    return { app, storage };
  };

  it('배포 → 조회 → 업데이트 → 삭제 전체 플로우', async () => {
    const { app } = createApp();

    // 1. 초기 상태: 빈 import map
    const emptyRes = await app.request('/api');
    expect(emptyRes.status).toBe(200);
    const emptyMap = await emptyRes.json();
    expect(emptyMap.imports).toStrictEqual({});

    // 2. 앱 배포
    const deployRes = await app.request('/api/services/@flex/checkout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://cdn.flex.team/checkout-v1.js' }),
    });
    expect(deployRes.status).toBe(200);
    const deployResult = await deployRes.json();
    expect(deployResult.importMap.imports['@flex/checkout']).toBe(
      'https://cdn.flex.team/checkout-v1.js',
    );

    // 3. 조회 — 배포된 앱이 포함된 import map
    const getRes = await app.request('/api');
    const currentMap = await getRes.json();
    expect(currentMap.imports['@flex/checkout']).toBe('https://cdn.flex.team/checkout-v1.js');

    // 4. 앱 업데이트 (새 버전 배포)
    const updateRes = await app.request('/api/services/@flex/checkout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://cdn.flex.team/checkout-v2.js' }),
    });
    expect(updateRes.status).toBe(200);
    const updateResult = await updateRes.json();
    expect(updateResult.importMap.imports['@flex/checkout']).toBe(
      'https://cdn.flex.team/checkout-v2.js',
    );

    // 5. 앱 삭제
    const deleteRes = await app.request('/api/services/@flex/checkout', {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(200);

    // 6. 삭제 후 조회 — 앱이 없어야 함
    const afterDeleteRes = await app.request('/api');
    const afterDeleteMap = await afterDeleteRes.json();
    expect(afterDeleteMap.imports['@flex/checkout']).toBeUndefined();
  });

  it('여러 앱 동시 배포 시나리오', async () => {
    const { app } = createApp();

    // 3개 앱을 순차 배포
    const apps = [
      { name: '@flex/checkout', url: 'https://cdn/checkout.js' },
      { name: '@flex/people', url: 'https://cdn/people.js' },
      { name: '@flex/gnb', url: 'https://cdn/gnb.js' },
    ];

    for (const appDef of apps) {
      await app.request(`/api/services/${appDef.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: appDef.url }),
      });
    }

    // 전체 import map 조회
    const res = await app.request('/api');
    const map = await res.json();

    expect(Object.keys(map.imports)).toHaveLength(3);
    expect(map.imports['@flex/checkout']).toBe('https://cdn/checkout.js');
    expect(map.imports['@flex/people']).toBe('https://cdn/people.js');
    expect(map.imports['@flex/gnb']).toBe('https://cdn/gnb.js');
  });

  it('배포 → 롤백 워크플로우', async () => {
    const { app } = createApp();

    // v1 배포
    await app.request('/api/services/@flex/checkout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://cdn/checkout-v1.js' }),
    });

    // v2 배포
    await app.request('/api/services/@flex/checkout', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://cdn/checkout-v2.js' }),
    });

    // 현재 v2 확인
    const beforeRollback = await app.request('/api');
    const beforeMap = await beforeRollback.json();
    expect(beforeMap.imports['@flex/checkout']).toBe('https://cdn/checkout-v2.js');

    // 롤백
    const rollbackRes = await app.request('/api/rollback/@flex/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://cdn/checkout-v1.js' }),
    });
    expect(rollbackRes.status).toBe(200);

    // 롤백 후 v1 확인
    const afterRollback = await app.request('/api');
    const afterMap = await afterRollback.json();
    expect(afterMap.imports['@flex/checkout']).toBe('https://cdn/checkout-v1.js');
  });
});
