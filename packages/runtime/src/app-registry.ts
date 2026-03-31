import type { MfeApp, MfeAppStatus, RegisteredApp, ImportMap } from '@esmap/shared';
import {
  AppNotFoundError,
  AppAlreadyRegisteredError,
  AppLifecycleError,
  ContainerNotFoundError,
  isRecord,
} from '@esmap/shared';
import { createDefaultFallback, renderFallback } from './error-boundary.js';

/** Error boundary options. Controls fallback UI when app load/mount fails. */
export interface ErrorBoundaryOptions {
  /** Function to create fallback UI. Uses the default fallback when not specified. */
  readonly fallback?: (appName: string, error: Error) => HTMLElement | string;
  /** Maximum number of automatic retries. Defaults to 3. */
  readonly retryLimit?: number;
  /** Delay between retries (ms). Defaults to 1000. */
  readonly retryDelay?: number;
  /** Callback invoked when an error occurs */
  readonly onError?: (appName: string, error: Error) => void;
}

/** Information required for app registration */
export interface RegisterAppOptions {
  /** App name (import map specifier, e.g. "@flex/checkout") */
  readonly name: string;
  /** Active route matching function or pattern */
  readonly activeWhen: string | readonly string[] | ((location: Location) => boolean);
  /** DOM selector for the mount target */
  readonly container?: string;
  /** Per-app error boundary options. Overrides registry default options. */
  readonly errorBoundary?: ErrorBoundaryOptions;
}

/** AppRegistry creation options */
export interface AppRegistryOptions {
  /**
   * Import map. Used to resolve bare specifiers to URLs.
   * When provided, loads directly via URL during dynamic import,
   * bypassing native import map timing constraints.
   */
  readonly importMap?: ImportMap;
  /** Global error boundary options. Applied to all apps by default. */
  readonly errorBoundary?: ErrorBoundaryOptions;
}

/** App status change event */
export interface AppStatusChangeEvent {
  readonly appName: string;
  readonly from: MfeAppStatus;
  readonly to: MfeAppStatus;
}

/** Status change listener */
type StatusChangeListener = (event: AppStatusChangeEvent) => void;

/** Default maximum retry count */
const DEFAULT_RETRY_LIMIT = 3;

/** Default retry delay (ms) */
const DEFAULT_RETRY_DELAY = 1000;

/**
 * Registry that manages MFE apps.
 * Handles app registration, status management, and lifecycle execution.
 */
export class AppRegistry {
  private readonly apps = new Map<string, RegisteredApp>();
  private readonly listeners: StatusChangeListener[] = [];
  private readonly importMap: ImportMap | undefined;
  private readonly globalErrorBoundary: ErrorBoundaryOptions | undefined;
  private readonly appErrorBoundaries = new Map<string, ErrorBoundaryOptions>();
  private readonly retryCounts = new Map<string, number>();
  /** In-flight loadApp Promise — prevents duplicate loading of the same app */
  private readonly loadPromises = new Map<string, Promise<void>>();
  /** Names of apps targeted for keep-alive */
  private readonly keepAliveApps = new Set<string>();

  constructor(options?: AppRegistryOptions) {
    this.importMap = options?.importMap;
    this.globalErrorBoundary = options?.errorBoundary;
  }

  /** Returns the list of registered apps. */
  getApps(): readonly RegisteredApp[] {
    return Array.from(this.apps.values());
  }

  /** Looks up an app by name. */
  getApp(name: string): RegisteredApp | undefined {
    return this.apps.get(name);
  }

  /**
   * Registers a new MFE app in the registry.
   * @param options - registration options
   */
  registerApp(options: RegisterAppOptions): void {
    if (this.apps.has(options.name)) {
      throw new AppAlreadyRegisteredError(options.name);
    }

    if (options.errorBoundary) {
      this.appErrorBoundaries.set(options.name, options.errorBoundary);
    }

    const resolvedUrl = this.importMap?.imports[options.name];
    const registered: RegisteredApp = {
      name: options.name,
      activeWhen: createActiveWhenFn(options.activeWhen),
      loadApp: () => importMfeApp(resolvedUrl ?? options.name),
      container: options.container ?? '#app',
      status: 'NOT_LOADED',
    };

    this.apps.set(options.name, registered);
  }

  /** Removes an app from the registry. Unmounts first if currently mounted. */
  async unregisterApp(name: string): Promise<void> {
    const app = this.apps.get(name);
    if (!app) return;

    if (app.status === 'MOUNTED') {
      await this.unmountApp(name);
    }

    this.apps.delete(name);
    this.appErrorBoundaries.delete(name);
    this.retryCounts.delete(name);
  }

  /**
   * Loads and bootstraps the app module.
   * NOT_LOADED -> LOADING -> BOOTSTRAPPING -> NOT_MOUNTED
   * Shows fallback UI on failure when error boundary is configured.
   * Concurrent calls for the same app share a single Promise to prevent duplicate loading.
   */
  async loadApp(name: string): Promise<void> {
    const registered = this.requireApp(name);
    if (registered.status !== 'NOT_LOADED' && registered.status !== 'LOAD_ERROR') return;

    // Return the same Promise if a load is already in progress
    const existing = this.loadPromises.get(name);
    if (existing) return existing;

    const promise = this.executeLoadApp(name, registered);
    this.loadPromises.set(name, promise);

    try {
      await promise;
    } finally {
      this.loadPromises.delete(name);
    }
  }

  /**
   * Executes the actual app loading logic.
   * @param name - app name
   * @param registered - registered app info
   */
  private async executeLoadApp(name: string, registered: RegisteredApp): Promise<void> {
    const errorBoundaryOptions = this.getErrorBoundaryOptions(name);

    this.setStatus(registered, 'LOADING');

    try {
      const app = await registered.loadApp();
      registered.app = app;
      this.setStatus(registered, 'BOOTSTRAPPING');

      await app.bootstrap();
      this.setStatus(registered, 'NOT_MOUNTED');
      this.retryCounts.delete(name);
    } catch (error) {
      this.setStatus(registered, 'LOAD_ERROR');
      const lifecycleError = new AppLifecycleError(
        name,
        'load',
        error instanceof Error ? error : undefined,
      );

      if (errorBoundaryOptions) {
        this.handleErrorWithBoundary(registered, lifecycleError, errorBoundaryOptions);
        return;
      }

      throw lifecycleError;
    }
  }

  /**
   * Mounts the app.
   * NOT_MOUNTED -> MOUNTED
   * Shows fallback UI on failure when error boundary is configured.
   */
  async mountApp(name: string): Promise<void> {
    const registered = this.requireApp(name);
    const errorBoundaryOptions = this.getErrorBoundaryOptions(name);

    if (registered.status === 'FROZEN') {
      this.thawApp(registered);
      return;
    }

    if (registered.status === 'NOT_LOADED' || registered.status === 'LOAD_ERROR') {
      await this.loadApp(name);
    }

    if (registered.status !== 'NOT_MOUNTED') return;

    const container = document.querySelector<HTMLElement>(registered.container);
    if (!container) {
      throw new ContainerNotFoundError(registered.container);
    }

    try {
      if (!registered.app) {
        throw new AppLifecycleError(name, 'mount');
      }
      await registered.app.mount(container);
      // Ensure container is visible — it may have display:none from a
      // keep-alive freeze of a different app sharing the same container.
      container.style.display = '';
      this.setStatus(registered, 'MOUNTED');
    } catch (error) {
      const mountError =
        error instanceof AppLifecycleError
          ? error
          : new AppLifecycleError(name, 'mount', error instanceof Error ? error : undefined);

      if (errorBoundaryOptions) {
        this.handleErrorWithBoundary(registered, mountError, errorBoundaryOptions);
        return;
      }

      throw mountError;
    }
  }

  /**
   * Unmounts the app.
   * Keep-alive apps: MOUNTED -> FROZEN (DOM preserved, container hidden)
   * Regular apps: MOUNTED -> UNMOUNTING -> NOT_MOUNTED
   */
  async unmountApp(name: string): Promise<void> {
    const registered = this.requireApp(name);
    if (registered.status !== 'MOUNTED') return;

    if (this.keepAliveApps.has(name)) {
      this.freezeApp(registered);
      return;
    }

    this.setStatus(registered, 'UNMOUNTING');

    const container = document.querySelector<HTMLElement>(registered.container);
    if (container && registered.app) {
      await registered.app.unmount(container);
    }

    this.setStatus(registered, 'NOT_MOUNTED');
  }

  /**
   * Configures the keep-alive state of an app.
   * Keep-alive apps preserve DOM and hide the container on unmount.
   * @param name - app name
   * @param enabled - whether to enable keep-alive
   */
  setKeepAlive(name: string, enabled: boolean): void {
    if (enabled) {
      this.keepAliveApps.add(name);
    } else {
      this.keepAliveApps.delete(name);
    }
  }

  /** Returns whether the app is in keep-alive mode. */
  isKeepAlive(name: string): boolean {
    return this.keepAliveApps.has(name);
  }

  /** Registers a status change listener. Returns an unsubscribe function. */
  onStatusChange(listener: StatusChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Unmounts all mounted/FROZEN apps and fully cleans up the registry. */
  async destroy(): Promise<void> {
    const activeApps = this.getApps().filter(
      (app) => app.status === 'MOUNTED' || app.status === 'FROZEN',
    );

    // Disable keep-alive for FROZEN apps first so actual unmount runs
    for (const app of activeApps) {
      this.keepAliveApps.delete(app.name);
      if (app.status === 'FROZEN') {
        this.thawApp(app);
      }
    }

    await Promise.all(activeApps.map((app) => this.unmountApp(app.name)));

    this.apps.clear();
    this.listeners.length = 0;
    this.appErrorBoundaries.clear();
    this.retryCounts.clear();
    this.loadPromises.clear();
    this.keepAliveApps.clear();
  }

  /** Returns the current retry count for an app. */
  getRetryCount(name: string): number {
    return this.retryCounts.get(name) ?? 0;
  }

  /**
   * Transitions a mounted app to FROZEN state.
   * Hides the container while preserving DOM for fast reactivation.
   */
  private freezeApp(registered: RegisteredApp): void {
    const container = document.querySelector<HTMLElement>(registered.container);
    if (container) {
      container.style.display = 'none';
    }
    this.setStatus(registered, 'FROZEN');
  }

  /**
   * Restores a FROZEN app to MOUNTED state.
   * Shows the hidden container to instantly restore DOM state.
   */
  private thawApp(registered: RegisteredApp): void {
    const container = document.querySelector<HTMLElement>(registered.container);
    if (container) {
      container.style.display = '';
    }
    this.setStatus(registered, 'MOUNTED');
  }

  /** Looks up an app by name and throws if not found. */
  private requireApp(name: string): RegisteredApp {
    const app = this.apps.get(name);
    if (!app) {
      throw new AppNotFoundError(name);
    }
    return app;
  }

  /** Changes app status and notifies listeners. */
  private setStatus(app: RegisteredApp, status: MfeAppStatus): void {
    const from = app.status;
    app.status = status;
    const event: AppStatusChangeEvent = { appName: app.name, from, to: status };
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Retrieves per-app or global error boundary options. */
  private getErrorBoundaryOptions(name: string): ErrorBoundaryOptions | undefined {
    return this.appErrorBoundaries.get(name) ?? this.globalErrorBoundary;
  }

  /**
   * Handles errors via the error boundary and displays fallback UI.
   * Shows permanent fallback without retry button when retry limit is reached.
   */
  private handleErrorWithBoundary(
    registered: RegisteredApp,
    error: AppLifecycleError,
    options: ErrorBoundaryOptions,
  ): void {
    const retryLimit = options.retryLimit ?? DEFAULT_RETRY_LIMIT;
    const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;
    const currentRetryCount = this.retryCounts.get(registered.name) ?? 0;

    options.onError?.(registered.name, error);

    const container = document.querySelector<HTMLElement>(registered.container);
    if (!container) return;

    const isRetryLimitReached = currentRetryCount >= retryLimit;

    if (options.fallback) {
      const fallbackContent = options.fallback(registered.name, error);
      renderFallback(container, fallbackContent);
      return;
    }

    if (isRetryLimitReached) {
      const permanentFallback = createDefaultFallback(registered.name, error, () => {
        /* Retry not possible — noop */
      });
      const retryButton = permanentFallback.querySelector('button');
      if (retryButton) {
        retryButton.remove();
      }
      renderFallback(container, permanentFallback);
      return;
    }

    const onRetry = () => {
      const attempt = (this.retryCounts.get(registered.name) ?? 0) + 1;
      this.retryCounts.set(registered.name, attempt);
      this.setStatus(registered, 'NOT_LOADED');

      const exponentialDelay = retryDelay * Math.pow(2, attempt - 1);
      setTimeout(() => {
        void this.loadApp(registered.name);
      }, exponentialDelay);
    };

    const fallbackElement = createDefaultFallback(registered.name, error, onRetry);
    renderFallback(container, fallbackElement);
  }
}

/** Converts activeWhen options to a function. */
function createActiveWhenFn(
  activeWhen: string | readonly string[] | ((location: Location) => boolean),
): (location: Location) => boolean {
  if (typeof activeWhen === 'function') return activeWhen;

  const patterns = typeof activeWhen === 'string' ? [activeWhen] : activeWhen;

  return (location: Location) => patterns.some((pattern) => location.pathname.startsWith(pattern));
}

/** Dynamically imports an MFE module. Accepts a URL or bare specifier. */
async function importMfeApp(specifierOrUrl: string): Promise<MfeApp> {
  const module: unknown = await import(/* @vite-ignore */ specifierOrUrl);

  if (!isRecord(module)) {
    throw new AppLifecycleError(
      specifierOrUrl,
      'load',
      new Error(
        `Module does not export an object. ` +
          `MFE modules must export bootstrap(), mount(), and unmount().`,
      ),
    );
  }

  if (isValidMfeApp(module.default)) return module.default;
  if (isValidMfeApp(module)) return module;

  const exportedKeys = Object.keys(module).join(', ') || '(none)';
  const missingMethods = ['bootstrap', 'mount', 'unmount']
    .filter((m) => typeof module[m] !== 'function')
    .join(', ');

  throw new AppLifecycleError(
    specifierOrUrl,
    'load',
    new Error(
      `Missing MFE lifecycle methods: ${missingMethods}. ` +
        `Current exports: [${exportedKeys}]. ` +
        `Module must export or default-export bootstrap(), mount(), and unmount().`,
    ),
  );
}

/** Checks whether the value implements the MfeApp interface. */
function isValidMfeApp(value: unknown): value is MfeApp {
  if (!isRecord(value)) return false;
  return (
    typeof value.bootstrap === 'function' &&
    typeof value.mount === 'function' &&
    typeof value.unmount === 'function'
  );
}
