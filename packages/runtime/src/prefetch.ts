/** Prefetch strategy */
export type PrefetchStrategy = 'idle' | 'immediate';

/** Prefetch target app info */
export interface PrefetchAppConfig {
  /** App name */
  readonly name: string;
  /** App module URL */
  readonly url: string;
}

/** Prefetch creation options */
export interface PrefetchOptions {
  /** Prefetch strategy */
  readonly strategy: PrefetchStrategy;
  /** List of apps to prefetch */
  readonly apps: readonly PrefetchAppConfig[];
  /** Import map — used to resolve URLs for name-based prefetching */
  readonly importMap?: { readonly imports: Readonly<Record<string, string>> };
}

/** Prefetch controller */
export interface PrefetchController {
  /** Starts prefetching */
  start(): void;
  /** Stops prefetching */
  stop(): void;
  /** Immediately prefetches a specific app */
  prefetchApp(app: PrefetchAppConfig): void;
  /** Prefetches an app by name. Resolves URL from the import map. */
  prefetchByName(name: string): void;
  /** Returns the list of prefetched app names */
  getPrefetchedApps(): readonly string[];
}

/**
 * Creates a smart preloading controller.
 * The idle strategy uses requestIdleCallback, and the immediate strategy executes right away.
 * @param options - prefetch options
 * @returns prefetch controller
 */
export function createPrefetch(options: PrefetchOptions): PrefetchController {
  const prefetched = new Set<string>();
  const pendingCallbacks: number[] = [];
  const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
  const addedLinks = new Set<string>();

  /** Adds a modulepreload link element */
  function addPreloadLink(url: string): void {
    if (addedLinks.has(url)) return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = url;
    document.head.appendChild(link);
    addedLinks.add(url);
  }

  /**
   * Prefetches a single app. Ignores empty URLs.
   * @param app - app config to prefetch
   */
  function doPrefetchApp(app: PrefetchAppConfig): void {
    if (prefetched.has(app.name) || !app.url) return;
    addPreloadLink(app.url);
    prefetched.add(app.name);
  }

  return {
    start(): void {
      const { strategy, apps } = options;

      if (strategy === 'immediate') {
        for (const app of apps) {
          doPrefetchApp(app);
        }
        return;
      }

      /* idle strategy: use requestIdleCallback if available, otherwise fall back to setTimeout */
      if (typeof requestIdleCallback === 'function') {
        for (const app of apps) {
          const id = requestIdleCallback(() => {
            doPrefetchApp(app);
          });
          pendingCallbacks.push(id);
        }
      } else {
        for (const app of apps) {
          const id = setTimeout(() => {
            doPrefetchApp(app);
          }, 200);
          pendingTimeouts.push(id);
        }
      }
    },

    stop(): void {
      for (const id of pendingCallbacks) {
        cancelIdleCallback(id);
      }
      pendingCallbacks.length = 0;

      for (const id of pendingTimeouts) {
        clearTimeout(id);
      }
      pendingTimeouts.length = 0;
    },

    prefetchApp(app: PrefetchAppConfig): void {
      doPrefetchApp(app);
    },

    prefetchByName(name: string): void {
      const url = options.importMap?.imports[name];
      if (!url) return;
      doPrefetchApp({ name, url });
    },

    getPrefetchedApps(): readonly string[] {
      return Array.from(prefetched);
    },
  };
}
