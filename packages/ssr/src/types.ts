import type { ImportMap } from '@esmap/shared';

/** Resolves bare specifiers to URLs using an import map */
export interface ImportMapResolver {
  /** Resolves a bare specifier to an absolute URL */
  resolve(specifier: string, referrerUrl?: string): string;
}

/** Fetches and evaluates ESM modules on the server */
export interface ServerModuleLoader {
  /** Loads a module by bare specifier or URL */
  load<T = unknown>(specifier: string): Promise<T>;
  /** Prefetches modules into the cache */
  prefetch(specifiers: readonly string[]): Promise<void>;
  /** Clears the module cache */
  clearCache(): void;
}

/** Options for creating a server module loader */
export interface ServerModuleLoaderOptions {
  /** Import map resolver for bare specifiers */
  readonly resolver: ImportMapResolver;
  /** Custom fetch function (defaults to globalThis.fetch) */
  readonly fetchFn?: typeof globalThis.fetch;
  /** Cache TTL in milliseconds (0 = no expiry, default: 0) */
  readonly cacheTtl?: number;
  /** Specifiers resolved from local node_modules instead of fetching remotely */
  readonly externals?: Readonly<Record<string, string>>;
}

/** Result of server-side rendering */
export interface SsrRenderResult {
  /** Rendered HTML markup */
  readonly html: string;
  /** Additional head elements (styles, meta tags, etc.) */
  readonly head: string;
  /** Import map to embed in the HTML document */
  readonly importMap: ImportMap;
  /** URLs to add as modulepreload hints */
  readonly preloadUrls: readonly string[];
}

/** Options for the SSR renderer */
export interface SsrRendererOptions {
  /** Import map for module resolution */
  readonly importMap: ImportMap;
  /** Pre-configured module loader (created automatically if omitted) */
  readonly moduleLoader?: ServerModuleLoader;
  /** Specifiers resolved from local node_modules instead of fetching remotely */
  readonly externals?: Readonly<Record<string, string>>;
}

/** Options for rendering a single app */
export interface RenderAppOptions {
  /** Props to pass to the app */
  readonly props?: Readonly<Record<string, unknown>>;
  /** Current URL path (for route matching) */
  readonly url?: string;
}

/** SSR renderer that loads and renders MFE apps on the server */
export interface SsrRenderer {
  /** Renders an MFE app to HTML */
  renderApp(appName: string, options?: RenderAppOptions): Promise<SsrRenderResult>;
  /** Access the underlying module loader */
  readonly moduleLoader: ServerModuleLoader;
  /** Access the underlying resolver */
  readonly resolver: ImportMapResolver;
}

/** Server-renderable MFE module that optionally exports an ssrRender function */
export interface SsrMfeModule {
  /** Server-side render function returning HTML markup */
  ssrRender(props?: Readonly<Record<string, unknown>>): Promise<string> | string;
}

/** Options for composing an HTML document shell */
export interface HtmlComposerOptions {
  /** Import map to embed as a script tag */
  readonly importMap: ImportMap;
  /** Rendered app HTML markup */
  readonly appHtml: string;
  /** Additional head content (styles, meta, etc.) */
  readonly head?: string;
  /** Additional body attributes */
  readonly bodyAttrs?: string;
  /** URLs for modulepreload link tags */
  readonly preloadUrls?: readonly string[];
  /** Inline hydration script to include at the end of body */
  readonly hydrationScript?: string;
  /** Container element id (default: "root") */
  readonly containerId?: string;
  /** Page title */
  readonly title?: string;
  /** Language attribute for html tag (default: "en") */
  readonly lang?: string;
}
