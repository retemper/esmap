/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResourceLoader } from './resource-loader.js';
import type { FetchInterceptor, JsTransformer, CssTransformer } from './resource-loader.js';

describe('createResourceLoader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('기본 로딩', () => {
    it('JS 리소스를 fetch하여 반환한다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('console.log("hello")', { status: 200 }),
      );

      const loader = createResourceLoader({ enableCache: false });
      const result = await loader.loadScript('https://cdn.example.com/app.js');

      expect(result).toBe('console.log("hello")');
    });

    it('CSS 리소스를 fetch하여 반환한다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('.app { color: red }', { status: 200 }),
      );

      const loader = createResourceLoader({ enableCache: false });
      const result = await loader.loadStylesheet('https://cdn.example.com/style.css');

      expect(result).toBe('.app { color: red }');
    });

    it('fetch 실패 시 에러를 던진다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Not Found', { status: 404 }),
      );

      const loader = createResourceLoader({ enableCache: false });

      await expect(loader.loadScript('https://cdn.example.com/missing.js')).rejects.toThrow(
        '리소스 로드 실패',
      );
    });
  });

  describe('캐싱', () => {
    it('동일 URL의 두 번째 요청은 캐시에서 반환한다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('cached-content', { status: 200 }),
      );

      const loader = createResourceLoader();
      await loader.loadScript('https://cdn.example.com/app.js');
      await loader.loadScript('https://cdn.example.com/app.js');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('캐시를 비우면 다시 fetch한다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        () => Promise.resolve(new Response('content', { status: 200 })),
      );

      const loader = createResourceLoader();
      await loader.loadScript('https://cdn.example.com/app.js');

      loader.clearCache();
      await loader.loadScript('https://cdn.example.com/app.js');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('enableCache: false이면 캐시하지 않는다', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        () => Promise.resolve(new Response('content', { status: 200 })),
      );

      const loader = createResourceLoader({ enableCache: false });
      await loader.loadScript('https://cdn.example.com/app.js');
      await loader.loadScript('https://cdn.example.com/app.js');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetch 인터셉터', () => {
    it('fetch 인터셉터가 URL을 변경할 수 있다', async () => {
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

    it('fetch 인터셉터가 응답을 직접 반환할 수 있다', async () => {
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

    it('여러 fetch 인터셉터가 체이닝된다', async () => {
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

  describe('JS 변환기', () => {
    it('JS 소스코드를 변환한다', async () => {
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

    it('여러 JS 변환기가 순서대로 실행된다', async () => {
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

  describe('CSS 변환기', () => {
    it('CSS 소스코드를 변환한다', async () => {
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
    it('등록된 인터셉터/변환기 이름을 반환한다', () => {
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
