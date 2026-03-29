/**
 * 리소스 로딩 파이프라인.
 * JS/CSS 리소스의 로딩, 변환, 캐싱을 단계별 인터셉터로 제어한다.
 * wujie(Tencent)의 세밀한 리소스 로딩 hook 시스템에서 영감을 받았다.
 *
 * 파이프라인: fetch → transform → cache
 * 각 단계에서 인터셉터가 리소스를 변환하거나 대체할 수 있다.
 */

/** fetch 단계 인터셉터. URL이나 요청 옵션을 수정할 수 있다. */
export interface FetchInterceptor {
  /** 인터셉터 이름 (디버깅용) */
  readonly name: string;
  /**
   * fetch 요청을 가로채어 수정하거나 대체 응답을 반환한다.
   * @param url - 요청 URL
   * @param next - 다음 인터셉터 또는 실제 fetch 호출
   * @returns 응답 텍스트
   */
  handle(url: string, next: (url: string) => Promise<string>): Promise<string>;
}

/** JS 소스코드 변환기. 로드된 JS를 실행 전에 변환한다. */
export interface JsTransformer {
  /** 변환기 이름 (디버깅용) */
  readonly name: string;
  /**
   * JS 소스코드를 변환한다.
   * @param code - 원본 소스코드
   * @param url - 리소스 URL (출처 추적용)
   * @returns 변환된 소스코드
   */
  transform(code: string, url: string): string | Promise<string>;
}

/** CSS 소스코드 변환기. 로드된 CSS를 주입 전에 변환한다. */
export interface CssTransformer {
  /** 변환기 이름 (디버깅용) */
  readonly name: string;
  /**
   * CSS 소스코드를 변환한다.
   * @param code - 원본 CSS
   * @param url - 리소스 URL (출처 추적용)
   * @returns 변환된 CSS
   */
  transform(code: string, url: string): string | Promise<string>;
}

/** 리소스 캐시 엔트리 */
interface CacheEntry {
  readonly content: string;
  readonly timestamp: number;
}

/** 리소스 로더 옵션 */
export interface ResourceLoaderOptions {
  /** 캐시 활성화 여부. 기본값 true. */
  readonly enableCache?: boolean;
  /** 캐시 TTL (ms). 기본값 5분. */
  readonly cacheTtl?: number;
  /** fetch 타임아웃 (ms). 기본값 30초. 0이면 타임아웃 없음. */
  readonly fetchTimeout?: number;
}

/** 리소스 로딩 파이프라인 인터페이스 */
export interface ResourceLoader {
  /** fetch 단계 인터셉터를 추가한다. */
  addFetchInterceptor(interceptor: FetchInterceptor): void;
  /** JS 변환기를 추가한다. */
  addJsTransformer(transformer: JsTransformer): void;
  /** CSS 변환기를 추가한다. */
  addCssTransformer(transformer: CssTransformer): void;
  /** JS 리소스를 파이프라인을 거쳐 로드한다. */
  loadScript(url: string): Promise<string>;
  /** CSS 리소스를 파이프라인을 거쳐 로드한다. */
  loadStylesheet(url: string): Promise<string>;
  /** 캐시를 비운다. */
  clearCache(): void;
  /** 등록된 인터셉터/변환기 이름 목록을 반환한다 (디버깅용). */
  getRegisteredNames(): { readonly fetch: readonly string[]; readonly js: readonly string[]; readonly css: readonly string[] };
}

/** 기본 캐시 TTL (5분) */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * 리소스 로딩 파이프라인을 생성한다.
 * fetch 인터셉터, JS/CSS 변환기를 등록하여 리소스 로딩을 제어할 수 있다.
 *
 * @param options - 리소스 로더 옵션
 * @returns ResourceLoader 인스턴스
 */
export function createResourceLoader(options: ResourceLoaderOptions = {}): ResourceLoader {
  const { enableCache = true, cacheTtl = DEFAULT_CACHE_TTL, fetchTimeout = 30_000 } = options;

  const fetchInterceptors: FetchInterceptor[] = [];
  const jsTransformers: JsTransformer[] = [];
  const cssTransformers: CssTransformer[] = [];
  const cache = new Map<string, CacheEntry>();

  /** 캐시에서 유효한 엔트리를 조회한다. */
  function getCached(key: string): string | undefined {
    if (!enableCache) return undefined;
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > cacheTtl) {
      cache.delete(key);
      return undefined;
    }
    return entry.content;
  }

  /** 캐시에 저장한다. */
  function setCache(key: string, content: string): void {
    if (!enableCache) return;
    cache.set(key, { content, timestamp: Date.now() });
  }

  /**
   * fetch 인터셉터 체인을 실행한다.
   * @param url - 로드할 리소스 URL
   */
  function executeFetchChain(url: string): Promise<string> {
    /**
     * 인터셉터 체인의 현재 위치에서 다음을 실행하는 함수를 생성한다.
     * @param index - 현재 인터셉터 인덱스
     */
    function createNext(index: number): (nextUrl: string) => Promise<string> {
      return async (nextUrl: string): Promise<string> => {
        if (index >= fetchInterceptors.length) {
          const controller = fetchTimeout > 0 ? new AbortController() : undefined;
          const timer = controller
            ? setTimeout(() => controller.abort(), fetchTimeout)
            : undefined;
          try {
            const response = await fetch(nextUrl, { signal: controller?.signal });
            if (!response.ok) {
              throw new Error(`리소스 로드 실패: ${nextUrl} (${response.status})`);
            }
            return await response.text();
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              throw new Error(`리소스 로드 타임아웃: ${nextUrl} (${fetchTimeout}ms)`);
            }
            throw error;
          } finally {
            if (timer !== undefined) clearTimeout(timer);
          }
        }
        return fetchInterceptors[index].handle(nextUrl, createNext(index + 1));
      };
    }

    return createNext(0)(url);
  }

  /** 변환기 체인을 순서대로 실행한다. */
  async function runTransformers(
    transformers: readonly { transform(code: string, url: string): string | Promise<string> }[],
    code: string,
    url: string,
  ): Promise<string> {
    const result = { value: code };
    for (const transformer of transformers) {
      result.value = await transformer.transform(result.value, url);
    }
    return result.value;
  }

  return {
    addFetchInterceptor(interceptor: FetchInterceptor): void {
      fetchInterceptors.push(interceptor);
    },

    addJsTransformer(transformer: JsTransformer): void {
      jsTransformers.push(transformer);
    },

    addCssTransformer(transformer: CssTransformer): void {
      cssTransformers.push(transformer);
    },

    async loadScript(url: string): Promise<string> {
      const cacheKey = `js:${url}`;
      const cached = getCached(cacheKey);
      if (cached !== undefined) return cached;

      const raw = await executeFetchChain(url);
      const transformed = await runTransformers(jsTransformers, raw, url);
      setCache(cacheKey, transformed);
      return transformed;
    },

    async loadStylesheet(url: string): Promise<string> {
      const cacheKey = `css:${url}`;
      const cached = getCached(cacheKey);
      if (cached !== undefined) return cached;

      const raw = await executeFetchChain(url);
      const transformed = await runTransformers(cssTransformers, raw, url);
      setCache(cacheKey, transformed);
      return transformed;
    },

    clearCache(): void {
      cache.clear();
    },

    getRegisteredNames(): { readonly fetch: readonly string[]; readonly js: readonly string[]; readonly css: readonly string[] } {
      return {
        fetch: fetchInterceptors.map((i) => i.name),
        js: jsTransformers.map((t) => t.name),
        css: cssTransformers.map((t) => t.name),
      };
    },
  };
}
