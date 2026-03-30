/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResourceLoader } from './resource-loader.js';
import type { FetchInterceptor, JsTransformer, CssTransformer } from './resource-loader.js';

describe('createResourceLoader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic loading', () => {
    it('fetches and returns a JS resource', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('console.log("hello")', { status: 200 }),
      );

      const loader = createResourceLoader({ enableCache: false });
      const result = await loader.loadScript('https://cdn.example.com/app.js');

      expect(result).toBe('console.log("hello")');
    });

    it('fetches and returns a CSS resource', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('.app { color: red }', { status: 200 }),
      );

      const loader = createResourceLoader({ enableCache: false });
      const result = await loader.loadStylesheet('https://cdn.example.com/style.css');

      expect(result).toBe('.app { color: red }');
    });

    it('throws an error on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Not Found', { status: 404 }),
      );

      const loader = createResourceLoader({ enableCache: false });

      await expect(loader.loadScript('https://cdn.example.com/missing.js')).rejects.toThrow(
        'Failed to load resource',
      );
    });
  });

  describe('caching', () => {
    it('returns the second request for the same URL from cache', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('cached-content', { status: 200 }),
      );

      const loader = createResourceLoader();
      await loader.loadScript('https://cdn.example.com/app.js');
      await loader.loadScript('https://cdn.example.com/app.js');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('fetches again after clearing the cache', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        () => Promise.resolve(new Response('content', { status: 200 })),
      );

      const loader = createResourceLoader();
      await loader.loadScript('https://cdn.example.com/app.js');

      loader.clearCache();
      await loader.loadScript('https://cdn.example.com/app.js');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('does not cache when enableCache is false', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        () => Promise.resolve(new Response('content', { status: 200 })),
      );

      const loader = createResourceLoader({ enableCache: false });
      await loader.loadScript('https://cdn.example.com/app.js');
      await loader.loadScript('https://cdn.example.com/app.js');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetch interceptors', () => {
    it('allows a fetch interceptor to modify the URL', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('proxied', { status: 200 }),
      );

      const interceptor: FetchInterceptor = {
        name: 'cors-proxy',
        async handle(url, next) {
          return next(`https://proxy.example.com/?url=${encodeURIComponent(url)}`);
        },
      };

      const loader = createResourceLoader({ enableCache: false });
      loader.addFetchInterceptor(interceptor);

      await loader.loadScript('https://remote.example.com/app.js');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://proxy.example.com/?url=https%3A%2F%2Fremote.example.com%2Fapp.js',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('allows a fetch interceptor to return a response directly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const interceptor: FetchInterceptor = {
        name: 'mock',
        async handle(_url, _next) {
          return 'mocked-response';
        },
      };

      const loader = createResourceLoader({ enableCache: false });
      loader.addFetchInterceptor(interceptor);

      const result = await loader.loadScript('https://cdn.example.com/app.js');

      expect(result).toBe('mocked-response');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('chains multiple fetch interceptors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('original', { status: 200 }),
      );

      const order: string[] = [];

      const first: FetchInterceptor = {
        name: 'first',
        async handle(url, next) {
          order.push('first-before');
          const result = await next(url);
          order.push('first-after');
          return result;
        },
      };

      const second: FetchInterceptor = {
        name: 'second',
        async handle(url, next) {
          order.push('second-before');
          const result = await next(url);
          order.push('second-after');
          return result;
        },
      };

      const loader = createResourceLoader({ enableCache: false });
      loader.addFetchInterceptor(first);
      loader.addFetchInterceptor(second);

      await loader.loadScript('https://cdn.example.com/app.js');

      expect(order).toStrictEqual(['first-before', 'second-before', 'second-after', 'first-after']);
    });
  });

  describe('JS transformers', () => {
    it('transforms JS source code', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('var x = 1;', { status: 200 }),
      );

      const transformer: JsTransformer = {
        name: 'strict-mode',
        transform(code) {
          return `"use strict";\n${code}`;
        },
      };

      const loader = createResourceLoader({ enableCache: false });
      loader.addJsTransformer(transformer);

      const result = await loader.loadScript('https://cdn.example.com/app.js');
      expect(result).toBe('"use strict";\nvar x = 1;');
    });

    it('executes multiple JS transformers in order', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('code', { status: 200 }),
      );

      const first: JsTransformer = {
        name: 'wrapper',
        transform(code) {
          return `(function(){${code}})()`;
        },
      };

      const second: JsTransformer = {
        name: 'comment',
        transform(code) {
          return `/* transformed */\n${code}`;
        },
      };

      const loader = createResourceLoader({ enableCache: false });
      loader.addJsTransformer(first);
      loader.addJsTransformer(second);

      const result = await loader.loadScript('https://cdn.example.com/app.js');
      expect(result).toBe('/* transformed */\n(function(){code})()');
    });
  });

  describe('CSS transformers', () => {
    it('transforms CSS source code', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('.btn { color: red }', { status: 200 }),
      );

      const transformer: CssTransformer = {
        name: 'prefix',
        transform(code) {
          return code.replace('.btn', '.app-checkout .btn');
        },
      };

      const loader = createResourceLoader({ enableCache: false });
      loader.addCssTransformer(transformer);

      const result = await loader.loadStylesheet('https://cdn.example.com/style.css');
      expect(result).toBe('.app-checkout .btn { color: red }');
    });
  });

  describe('getRegisteredNames', () => {
    it('returns registered interceptor/transformer names', () => {
      const loader = createResourceLoader();

      loader.addFetchInterceptor({ name: 'proxy', handle: async (_url, next) => next(_url) });
      loader.addJsTransformer({ name: 'strict', transform: (code) => code });
      loader.addCssTransformer({ name: 'scope', transform: (code) => code });

      const names = loader.getRegisteredNames();
      expect(names).toStrictEqual({
        fetch: ['proxy'],
        js: ['strict'],
        css: ['scope'],
      });
    });
  });
});
