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

  describe('app rendering', () => {
    it('calls ssrRender and returns the HTML', async () => {
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

    it('passes props to ssrRender', async () => {
      const mockModule = {
        ssrRender: vi.fn().mockReturnValue('<div>Cart: 3</div>'),
      };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      await renderer.renderApp('@myorg/checkout', { props: { itemCount: 3 } });

      expect(mockModule.ssrRender).toHaveBeenCalledWith({ itemCount: 3 });
    });

    it('supports async ssrRender', async () => {
      const mockModule = {
        ssrRender: vi.fn().mockResolvedValue('<div>Async</div>'),
      };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      const result = await renderer.renderApp('@myorg/checkout');

      expect(result.html).toBe('<div>Async</div>');
    });

    it('finds ssrRender from the default export', async () => {
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

  describe('error handling', () => {
    it('throws when the module has no ssrRender export', async () => {
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

    it('throws when the module is not an object', async () => {
      const loader = createMockLoader({ '@myorg/checkout': 'not an object' });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      await expect(renderer.renderApp('@myorg/checkout')).rejects.toThrow(
        'does not export an object',
      );
    });
  });

  describe('preload URL collection', () => {
    it('includes the app entry URL in preloadUrls', async () => {
      const mockModule = { ssrRender: () => '<div>App</div>' };
      const loader = createMockLoader({ '@myorg/checkout': mockModule });
      const renderer = createSsrRenderer({ importMap: baseImportMap, moduleLoader: loader });

      const result = await renderer.renderApp('@myorg/checkout');

      expect(result.preloadUrls).toContain('https://cdn.example.com/checkout.js');
    });
  });

  describe('renderer property access', () => {
    it('exposes moduleLoader and resolver', () => {
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
