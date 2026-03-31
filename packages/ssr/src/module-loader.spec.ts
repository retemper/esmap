import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServerModuleLoader } from './module-loader.js';
import type { ImportMapResolver } from './types.js';

describe('createServerModuleLoader', () => {
  /** Creates a simple resolver that maps specifiers to URLs */
  function createMockResolver(mappings: Record<string, string>): ImportMapResolver {
    return {
      resolve(specifier: string): string {
        const url = mappings[specifier];
        if (!url) throw new Error(`Cannot resolve: ${specifier}`);
        return url;
      },
    };
  }

  /** Creates a mock fetch that returns predefined responses */
  function createMockFetch(responses: Record<string, string>): typeof globalThis.fetch {
    return vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const body = responses[url];
      if (body === undefined) {
        return new Response(null, { status: 404, statusText: 'Not Found' });
      }
      return new Response(body, { status: 200, headers: { 'content-type': 'text/javascript' } });
    }) as typeof globalThis.fetch;
  }

  describe('externals 해석', () => {
    it('externals에 등록된 specifier는 로컬 import로 해석한다', async () => {
      const resolver = createMockResolver({});
      const loader = createServerModuleLoader({
        resolver,
        externals: { 'node:path': 'node:path' },
      });

      const mod = await loader.load<{ join: (...args: string[]) => string }>('node:path');

      expect(mod.join).toBeDefined();
      expect(typeof mod.join).toBe('function');
    });
  });

  describe('fetch 실패 처리', () => {
    it('404 응답에 대해 에러를 던진다', async () => {
      const resolver = createMockResolver({
        '@myorg/app': 'https://cdn.example.com/app.js',
      });
      const fetchFn = createMockFetch({});
      const loader = createServerModuleLoader({ resolver, fetchFn });

      await expect(loader.load('@myorg/app')).rejects.toThrow('Failed to fetch module');
    });
  });

  describe('캐시 동작', () => {
    it('clearCache 이후 다시 fetch한다', async () => {
      const resolver = createMockResolver({
        'mod-a': 'https://cdn.example.com/mod-a.js',
      });
      const fetchFn = createMockFetch({
        'https://cdn.example.com/mod-a.js': 'export const value = 42;',
      });
      const loader = createServerModuleLoader({ resolver, fetchFn });

      await loader.load('mod-a');
      expect(fetchFn).toHaveBeenCalledTimes(1);

      await loader.load('mod-a');
      expect(fetchFn).toHaveBeenCalledTimes(1);

      loader.clearCache();
      await loader.load('mod-a');
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('prefetch', () => {
    it('여러 모듈을 병렬로 미리 로드한다', async () => {
      const resolver = createMockResolver({
        'mod-a': 'https://cdn.example.com/a.js',
        'mod-b': 'https://cdn.example.com/b.js',
      });
      const fetchFn = createMockFetch({
        'https://cdn.example.com/a.js': 'export const a = 1;',
        'https://cdn.example.com/b.js': 'export const b = 2;',
      });
      const loader = createServerModuleLoader({ resolver, fetchFn });

      await loader.prefetch(['mod-a', 'mod-b']);

      expect(fetchFn).toHaveBeenCalledTimes(2);

      // Subsequent loads should use cache
      await loader.load('mod-a');
      await loader.load('mod-b');
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('externals에 등록된 specifier는 prefetch를 건너뛴다', async () => {
      const resolver = createMockResolver({});
      const fetchFn = createMockFetch({});
      const loader = createServerModuleLoader({
        resolver,
        fetchFn,
        externals: { react: 'react' },
      });

      await loader.prefetch(['react']);

      expect(fetchFn).not.toHaveBeenCalled();
    });
  });
});
