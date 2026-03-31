import { describe, it, expect, vi } from 'vitest';
import { createSsrRenderer } from './renderer.js';
import type { ServerModuleLoader } from './types.js';

describe('createSsrRenderer', () => {
  const baseImportMap = {
    imports: {
      '@myorg/checkout': 'https://cdn.example.com/checkout.js',
    },
  };

  /** Creates a mock module loader that returns the given module */
  function createMockLoader(modules: Record<string, unknown>): ServerModuleLoader {
    return {
      async load<T = unknown>(specifier: string): Promise<T> {
        const mod = modules[specifier];
        if (!mod) throw new Error(`Module not found: ${specifier}`);
        return mod as T;
      },
      async prefetch() {},
      clearCache() {},
    };
  }

  describe('앱 렌더링', () => {
    it('ssrRender를 호출하여 HTML을 반환한다', async () => {
      const mockModule = {
        ssrRender: vi.fn().mockReturnValue('<div>Checkout</div>'),
      };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      const result = await renderer.renderApp('@myorg/checkout');

      expect(result.html).toBe('<div>Checkout</div>');
      expect(result.importMap).toStrictEqual(baseImportMap);
      expect(mockModule.ssrRender).toHaveBeenCalledOnce();
    });

    it('props를 ssrRender에 전달한다', async () => {
      const mockModule = {
        ssrRender: vi.fn().mockReturnValue('<div>Cart: 3</div>'),
      };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      await renderer.renderApp('@myorg/checkout', { props: { itemCount: 3 } });

      expect(mockModule.ssrRender).toHaveBeenCalledWith({ itemCount: 3 });
    });

    it('async ssrRender를 지원한다', async () => {
      const mockModule = {
        ssrRender: vi.fn().mockResolvedValue('<div>Async</div>'),
      };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      const result = await renderer.renderApp('@myorg/checkout');

      expect(result.html).toBe('<div>Async</div>');
    });

    it('default export에서 ssrRender를 찾는다', async () => {
      const mockModule = {
        default: {
          ssrRender: vi.fn().mockReturnValue('<div>Default</div>'),
        },
      };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      const result = await renderer.renderApp('@myorg/checkout');

      expect(result.html).toBe('<div>Default</div>');
    });
  });

  describe('에러 처리', () => {
    it('ssrRender가 없는 모듈에서 에러를 던진다', async () => {
      const mockModule = {
        bootstrap: vi.fn(),
        mount: vi.fn(),
        unmount: vi.fn(),
      };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      await expect(renderer.renderApp('@myorg/checkout')).rejects.toThrow(
        'does not export an ssrRender() function',
      );
    });

    it('객체가 아닌 모듈에서 에러를 던진다', async () => {
      const loader = createMockLoader({ '@myorg/checkout': 'not an object' });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      await expect(renderer.renderApp('@myorg/checkout')).rejects.toThrow(
        'does not export an object',
      );
    });
  });

  describe('preload URL 수집', () => {
    it('import map에서 앱 entry URL을 preloadUrls에 포함한다', async () => {
      const mockModule = { ssrRender: () => '<div>App</div>' };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      const result = await renderer.renderApp('@myorg/checkout');

      expect(result.preloadUrls).toContain('https://cdn.example.com/checkout.js');
    });
  });

  describe('renderer 속성 접근', () => {
    it('moduleLoader와 resolver에 접근할 수 있다', () => {
      const loader = createMockLoader({});
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      expect(renderer.moduleLoader).toBe(loader);
      expect(renderer.resolver).toBeDefined();
      expect(renderer.resolver.resolve('@myorg/checkout')).toBe(
        'https://cdn.example.com/checkout.js',
      );
    });
  });
});
