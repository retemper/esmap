import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemStorage } from './filesystem.js';
import type { ImportMap } from '@esmap/shared';

describe('FileSystemStorage', () => {
  const tempDirPrefix = join(tmpdir(), 'esmap-test-');
  const tempDirs: string[] = [];

  async function createTempStorage(): Promise<{ storage: FileSystemStorage; dir: string }> {
    const dir = await mkdtemp(tempDirPrefix);
    tempDirs.push(dir);
    return { storage: new FileSystemStorage(dir), dir };
  }

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  describe('read', () => {
    it('파일이 없으면 null을 반환한다', async () => {
      const { storage } = await createTempStorage();
      const result = await storage.read();
      expect(result).toBeNull();
    });

    it('저장된 import map을 읽는다', async () => {
      const { storage } = await createTempStorage();

      await storage.update(() => ({
        imports: { react: 'https://cdn.example.com/react.js' },
      }));

      const result = await storage.read();
      expect(result?.imports.react).toBe('https://cdn.example.com/react.js');
    });
  });

  describe('update', () => {
    it('import map을 생성한다', async () => {
      const { storage } = await createTempStorage();

      const result = await storage.update(() => ({
        imports: { react: 'https://cdn.example.com/react.js' },
      }));

      expect(result.imports.react).toBe('https://cdn.example.com/react.js');
    });

    it('기존 import map을 갱신한다', async () => {
      const { storage } = await createTempStorage();

      await storage.update(() => ({
        imports: { react: 'https://cdn.example.com/react@18.js' },
      }));

      const result = await storage.update((current) => ({
        ...current,
        imports: { ...current.imports, vue: 'https://cdn.example.com/vue.js' },
      }));

      expect(result.imports.react).toBe('https://cdn.example.com/react@18.js');
      expect(result.imports.vue).toBe('https://cdn.example.com/vue.js');
    });

    it('동시 업데이트를 직렬화한다', async () => {
      const { storage } = await createTempStorage();

      await storage.update(() => ({
        imports: { counter: '0' },
      }));

      const updates = Array.from({ length: 10 }, (_, i) =>
        storage.update((current) => ({
          imports: {
            ...current.imports,
            [`service-${i}`]: `https://cdn.example.com/service-${i}.js`,
          },
        })),
      );

      const results = await Promise.all(updates);
      const finalMap = await storage.read();

      // 모든 서비스가 최종 맵에 존재해야 함
      expect(Object.keys(finalMap!.imports)).toHaveLength(11); // counter + 10 services
    });
  });

  describe('history', () => {
    it('배포 이력을 저장하고 조회한다', async () => {
      const { storage } = await createTempStorage();

      await storage.appendHistory({
        timestamp: '2026-03-21T12:00:00Z',
        service: '@flex/checkout',
        previousUrl: 'https://cdn.example.com/checkout-old.js',
        newUrl: 'https://cdn.example.com/checkout-new.js',
      });

      const history = await storage.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].service).toBe('@flex/checkout');
    });

    it('최신 이력이 먼저 나온다', async () => {
      const { storage } = await createTempStorage();

      await storage.appendHistory({
        timestamp: '2026-03-21T12:00:00Z',
        service: 'first',
        previousUrl: '',
        newUrl: 'https://first.js',
      });

      await storage.appendHistory({
        timestamp: '2026-03-21T13:00:00Z',
        service: 'second',
        previousUrl: '',
        newUrl: 'https://second.js',
      });

      const history = await storage.getHistory();

      expect(history[0].service).toBe('second');
      expect(history[1].service).toBe('first');
    });

    it('limit으로 조회 개수를 제한한다', async () => {
      const { storage } = await createTempStorage();

      for (const i of [0, 1, 2, 3, 4]) {
        await storage.appendHistory({
          timestamp: `2026-03-21T1${i}:00:00Z`,
          service: `service-${i}`,
          previousUrl: '',
          newUrl: `https://s${i}.js`,
        });
      }

      const history = await storage.getHistory(2);
      expect(history).toHaveLength(2);
    });

    it('이력이 없으면 빈 배열을 반환한다', async () => {
      const { storage } = await createTempStorage();
      const history = await storage.getHistory();
      expect(history).toStrictEqual([]);
    });
  });
});
