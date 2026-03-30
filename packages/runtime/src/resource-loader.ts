/**
 * Resource loading pipeline.
 * Controls loading, transformation, and caching of JS/CSS resources via staged interceptors.
 * Inspired by wujie (Tencent)'s granular resource loading hook system.
 *
 * Pipeline: fetch -> transform -> cache
 * At each stage, interceptors can transform or replace resources.
 */

/** Fetch stage interceptor. Can modify the URL or request options. */
export interface FetchInterceptor {
  /** Interceptor name (for debugging) */
  readonly name: string;
  /**
   * Intercepts a fetch request to modify it or return a replacement response.
   * @param url - request URL
   * @param next - next interceptor or actual fetch call
   * @returns response text
   */
  handle(url: string, next: (url: string) => Promise<string>): Promise<string>;
}

/** JS source code transformer. Transforms loaded JS before execution. */
export interface JsTransformer {
  /** Transformer name (for debugging) */
  readonly name: string;
  /**
   * Transforms JS source code.
   * @param code - original source code
   * @param url - resource URL (for origin tracking)
   * @returns transformed source code
   */
  transform(code: string, url: string): string | Promise<string>;
}

/** CSS source code transformer. Transforms loaded CSS before injection. */
export interface CssTransformer {
  /** Transformer name (for debugging) */
  readonly name: string;
  /**
   * Transforms CSS source code.
   * @param code - original CSS
   * @param url - resource URL (for origin tracking)
   * @returns transformed CSS
   */
  transform(code: string, url: string): string | Promise<string>;
}

/** Resource cache entry */
interface CacheEntry {
  readonly content: string;
  readonly timestamp: number;
}

/** Resource loader options */
export interface ResourceLoaderOptions {
  /** Whether caching is enabled. Defaults to true. */
  readonly enableCache?: boolean;
  /** Cache TTL (ms). Defaults to 5 minutes. */
  readonly cacheTtl?: number;
  /** Fetch timeout (ms). Defaults to 30 seconds. 0 disables timeout. */
  readonly fetchTimeout?: number;
}

/** Resource loading pipeline interface */
export interface ResourceLoader {
  /** Adds a fetch stage interceptor. */
  addFetchInterceptor(interceptor: FetchInterceptor): void;
  /** Adds a JS transformer. */
  addJsTransformer(transformer: JsTransformer): void;
  /** Adds a CSS transformer. */
  addCssTransformer(transformer: CssTransformer): void;
  /** Loads a JS resource through the pipeline. */
  loadScript(url: string): Promise<string>;
  /** Loads a CSS resource through the pipeline. */
  loadStylesheet(url: string): Promise<string>;
  /** Clears the cache. */
  clearCache(): void;
  /** Returns the list of registered interceptor/transformer names (for debugging). */
  getRegisteredNames(): { readonly fetch: readonly string[]; readonly js: readonly string[]; readonly css: readonly string[] };
}

/** Default cache TTL (5 minutes) */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Creates a resource loading pipeline.
 * Register fetch interceptors and JS/CSS transformers to control resource loading.
 *
 * @param options - resource loader options
 * @returns ResourceLoader instance
 */
export function createResourceLoader(options: ResourceLoaderOptions = {}): ResourceLoader {
  const { enableCache = true, cacheTtl = DEFAULT_CACHE_TTL, fetchTimeout = 30_000 } = options;

  const fetchInterceptors: FetchInterceptor[] = [];
  const jsTransformers: JsTransformer[] = [];
  const cssTransformers: CssTransformer[] = [];
  const cache = new Map<string, CacheEntry>();

  /** Looks up a valid entry from the cache. */
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

  /** Saves to the cache. */
  function setCache(key: string, content: string): void {
    if (!enableCache) return;
    cache.set(key, { content, timestamp: Date.now() });
  }

  /**
   * Executes the fetch interceptor chain.
   * @param url - resource URL to load
   */
  function executeFetchChain(url: string): Promise<string> {
    /**
     * Creates a function that executes the next step from the current position in the interceptor chain.
     * @param index - current interceptor index
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
              throw new Error(`Failed to load resource: ${nextUrl} (${response.status})`);
            }
            return await response.text();
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              throw new Error(`Resource load timeout: ${nextUrl} (${fetchTimeout}ms)`);
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

  /** Executes the transformer chain in order. */
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
