import type { RegisteredApp } from '@esmap/shared';

/** Minimal AppRegistry interface that Router depends on */
export interface RouterRegistry {
  /** Returns the list of registered apps. */
  getApps(): readonly RegisteredApp[];
  /** Mounts an app. */
  mountApp(name: string): Promise<void>;
  /** Unmounts an app. */
  unmountApp(name: string): Promise<void>;
}

/** Context representing the current route location */
export interface RouteContext {
  /** URL pathname (e.g. "/users/123") */
  readonly pathname: string;
  /** Query string (e.g. "?tab=profile") */
  readonly search: string;
  /** Hash (e.g. "#section") */
  readonly hash: string;
}

/**
 * Guard executed before route change.
 * Returning false cancels the navigation.
 */
export type BeforeRouteChangeGuard = (
  from: RouteContext,
  to: RouteContext,
) => Promise<boolean> | boolean;

/**
 * Guard executed after route change.
 * Called after mount/unmount completes.
 */
export type AfterRouteChangeGuard = (from: RouteContext, to: RouteContext) => void | Promise<void>;

/**
 * Callback invoked when a route is detected that does not match any app.
 * @param context - location info of the unmatched route
 */
export type NoMatchHandler = (context: RouteContext) => void;

/** Router options */
export interface RouterOptions {
  /** Route change detection method */
  readonly mode?: 'history' | 'hash';
  /** Base path prepended to all routes (e.g. "/my-app"). This prefix is stripped when making mount decisions. */
  readonly baseUrl?: string;
  /** Handler called when no registered app matches. Used for 404 handling. */
  readonly onNoMatch?: NoMatchHandler;
}

/** Creates a RouteContext from the current window.location. */
function captureRouteContext(): RouteContext {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

/** Strips the baseUrl prefix from a pathname. */
function stripBaseUrl(pathname: string, baseUrl: string): string {
  if (!baseUrl || baseUrl === '/') return pathname;
  if (pathname.startsWith(baseUrl)) {
    const stripped = pathname.slice(baseUrl.length);
    return stripped === '' ? '/' : stripped;
  }
  return pathname;
}

/**
 * Router that detects URL changes and mounts/unmounts appropriate MFEs.
 * Watches all of History API's popstate, pushState, and replaceState.
 * Navigation can be controlled through route guards.
 */
export class Router {
  private readonly registry: RouterRegistry;
  private readonly mode: 'history' | 'hash';
  private readonly baseUrl: string;
  private readonly onNoMatch: NoMatchHandler | undefined;
  private started = false;
  private readonly boundHandleRouteChange: () => void;
  private readonly beforeGuards: BeforeRouteChangeGuard[] = [];
  private readonly afterGuards: AfterRouteChangeGuard[] = [];
  private previousRoute: RouteContext = { pathname: '', search: '', hash: '' };
  private originalReplaceState: History['replaceState'] = history.replaceState.bind(history);
  /** Original pushState before patching — for restoration on stop() */
  private savedPushState: History['pushState'] | undefined;
  /** Original replaceState before patching — for restoration on stop() */
  private savedReplaceState: History['replaceState'] | undefined;
  /** Navigation version — invalidates previous operations on rapid consecutive navigation */
  private navigationVersion = 0;

  constructor(registry: RouterRegistry, options?: RouterOptions) {
    this.registry = registry;
    this.mode = options?.mode ?? 'history';
    this.baseUrl = normalizeBaseUrl(options?.baseUrl ?? '');
    this.onNoMatch = options?.onNoMatch;
    this.boundHandleRouteChange = () => {
      void this.handleRouteChange();
    };
  }

  /** Starts the router. Begins watching for URL changes and mounts the app matching the current URL. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.previousRoute = captureRouteContext();

    this.patchHistoryApi();

    const eventName = this.mode === 'hash' ? 'hashchange' : 'popstate';
    window.addEventListener(eventName, this.boundHandleRouteChange);
    window.addEventListener('esmap:navigate', this.boundHandleRouteChange);

    await this.handleRouteChange();
  }

  /** Stops the router and restores History API patches. */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    const eventName = this.mode === 'hash' ? 'hashchange' : 'popstate';
    window.removeEventListener(eventName, this.boundHandleRouteChange);
    window.removeEventListener('esmap:navigate', this.boundHandleRouteChange);

    this.restoreHistoryApi();
  }

  /**
   * Programmatic navigation — navigates to a new URL (history.pushState).
   * Automatically adds the prefix when baseUrl is set.
   * @param url - path to navigate to (e.g. "/settings", "/users?tab=all")
   */
  push(url: string): void {
    const fullUrl = this.resolveUrl(url);
    history.pushState(null, '', fullUrl);
  }

  /**
   * Programmatic navigation — replaces the current URL (history.replaceState).
   * Automatically adds the prefix when baseUrl is set.
   * @param url - path to replace with
   */
  replace(url: string): void {
    const fullUrl = this.resolveUrl(url);
    history.replaceState(null, '', fullUrl);
  }

  /** Navigates back in history. */
  back(): void {
    history.back();
  }

  /** Navigates forward in history. */
  forward(): void {
    history.forward();
  }

  /**
   * Navigates history by the given delta.
   * @param delta - positive for forward, negative for back
   */
  go(delta: number): void {
    history.go(delta);
  }

  /** Returns the current route context. */
  get currentRoute(): RouteContext {
    return captureRouteContext();
  }

  /**
   * Registers a before route change guard. Returns an unsubscribe function.
   * @param guard - guard function that cancels navigation when returning false
   * @returns guard removal function
   */
  beforeRouteChange(guard: BeforeRouteChangeGuard): () => void {
    this.beforeGuards.push(guard);
    return () => {
      const idx = this.beforeGuards.indexOf(guard);
      if (idx >= 0) this.beforeGuards.splice(idx, 1);
    };
  }

  /**
   * Registers an after route change guard. Returns an unsubscribe function.
   * @param guard - guard function executed after mount/unmount completes
   * @returns guard removal function
   */
  afterRouteChange(guard: AfterRouteChangeGuard): () => void {
    this.afterGuards.push(guard);
    return () => {
      const idx = this.afterGuards.indexOf(guard);
      if (idx >= 0) this.afterGuards.splice(idx, 1);
    };
  }

  /**
   * Executes all registered beforeRouteChange guards.
   * @param from - previous route context
   * @param to - next route context
   * @returns true if all guards return true, false if any guard returns false
   */
  private async runBeforeGuards(from: RouteContext, to: RouteContext): Promise<boolean> {
    for (const guard of this.beforeGuards) {
      const result = await guard(from, to);
      if (!result) {
        return false;
      }
    }
    return true;
  }

  /**
   * Executes all registered afterRouteChange guards.
   * @param from - previous route context
   * @param to - current route context
   */
  private async runAfterGuards(from: RouteContext, to: RouteContext): Promise<void> {
    for (const guard of this.afterGuards) {
      await guard(from, to);
    }
  }

  /**
   * Finds apps matching the current URL and mounts them, unmounts inactive apps.
   * Uses navigationVersion to invalidate previous operations on rapid consecutive navigation.
   */
  private async handleRouteChange(): Promise<void> {
    this.navigationVersion++;
    const version = this.navigationVersion;

    const from = this.previousRoute;
    const to = captureRouteContext();

    const allowed = await this.runBeforeGuards(from, to);
    if (!allowed) {
      this.originalReplaceState(null, '', `${from.pathname}${from.search}${from.hash}`);
      return;
    }

    // Invalidate previous operation if new navigation occurred during guard execution
    if (version !== this.navigationVersion) return;

    const apps = this.registry.getApps();
    const effectiveLocation = this.createEffectiveLocation();

    const toMount: RegisteredApp[] = [];
    const toUnmount: RegisteredApp[] = [];

    for (const app of apps) {
      const shouldBeActive = app.activeWhen(effectiveLocation);

      if (shouldBeActive && app.status !== 'MOUNTED') {
        toMount.push(app);
      } else if (!shouldBeActive && app.status === 'MOUNTED') {
        toUnmount.push(app);
      }
    }

    // Call 404 handler if no apps are active and none are to be mounted
    if (this.onNoMatch && toMount.length === 0) {
      const hasAnyActive = apps.some(
        (app) => app.activeWhen(effectiveLocation) && app.status === 'MOUNTED',
      );
      if (!hasAnyActive) {
        this.onNoMatch(to);
      }
    }

    const unmountPromises = toUnmount.map((app) => this.registry.unmountApp(app.name));
    await Promise.all(unmountPromises);

    // Skip mount if new navigation occurred after unmount completed
    if (version !== this.navigationVersion) return;

    await Promise.all(toMount.map((app) => this.registry.mountApp(app.name)));

    // Verify this is still the latest navigation even after mount completes
    if (version !== this.navigationVersion) return;

    this.previousRoute = to;

    await this.runAfterGuards(from, to);
  }

  /**
   * Patches pushState/replaceState to dispatch custom events.
   * Required because popstate alone cannot detect programmatic navigation.
   * Saves original methods for restoration on stop().
   */
  private patchHistoryApi(): void {
    this.savedPushState = history.pushState.bind(history);
    this.savedReplaceState = history.replaceState.bind(history);

    const originalPushState = this.savedPushState;
    const originalReplaceState = this.savedReplaceState;
    this.originalReplaceState = originalReplaceState;

    history.pushState = (...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      window.dispatchEvent(new CustomEvent('esmap:navigate'));
    };

    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      window.dispatchEvent(new CustomEvent('esmap:navigate'));
    };
  }

  /**
   * Constructs the actual URL considering the baseUrl.
   * @param url - relative path
   * @returns full path with baseUrl prefix
   */
  private resolveUrl(url: string): string {
    if (!this.baseUrl || this.baseUrl === '/') return url;
    // Use as-is if baseUrl prefix is already present
    if (url.startsWith(this.baseUrl)) return url;
    return `${this.baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  /**
   * Creates a virtual Location object with the baseUrl stripped.
   * Ensures activeWhen functions receive a pathname without baseUrl awareness.
   */
  private createEffectiveLocation(): Location {
    if (!this.baseUrl || this.baseUrl === '/') return window.location;
    const strippedPathname = stripBaseUrl(window.location.pathname, this.baseUrl);
    // Wrap Location with a Proxy to override only pathname
    return new Proxy(window.location, {
      get(target, prop) {
        if (prop === 'pathname') return strippedPathname;
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  /** Restores the patched History API to the originals. */
  private restoreHistoryApi(): void {
    if (this.savedPushState) {
      history.pushState = this.savedPushState;
    }
    if (this.savedReplaceState) {
      history.replaceState = this.savedReplaceState;
    }
    this.savedPushState = undefined;
    this.savedReplaceState = undefined;
  }
}

/** Normalizes the baseUrl by removing the trailing slash. */
function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl || baseUrl === '/') return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}
