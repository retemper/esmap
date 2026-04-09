# @esmap/runtime

Core runtime for esmap micro-frontends. Handles import map loading, application registry, client-side routing, error boundaries, and resource prefetching. (8.2 kB gzip)

## Installation

```bash
pnpm add @esmap/runtime
```

## Classes

### `AppRegistry`

```ts
class AppRegistry {
  constructor(options?: AppRegistryOptions);
  getApps(): readonly RegisteredApp[];
  getApp(name: string): RegisteredApp | undefined;
  registerApp(options: RegisterAppOptions): void;
  unregisterApp(name: string): Promise<void>;
  loadApp(name: string): Promise<void>;
  mountApp(name: string): Promise<void>;
  unmountApp(name: string): Promise<void>;
  setKeepAlive(name: string, enabled: boolean): void;
  isKeepAlive(name: string): boolean;
  onStatusChange(listener: (event: AppStatusChangeEvent) => void): () => void;
  getRetryCount(name: string): number;
  destroy(): Promise<void>;
}
```

Registry that manages MFE apps. Handles registration, status management, lifecycle execution, keep-alive, and error boundaries with automatic retry.

### `Router`

```ts
class Router {
  constructor(registry: RouterRegistry, options?: RouterOptions);
  start(): Promise<void>;
  stop(): void;
  push(url: string): void;
  replace(url: string): void;
  back(): void;
  forward(): void;
  go(delta: number): void;
  get currentRoute(): RouteContext;
  beforeRouteChange(guard: BeforeRouteChangeGuard): () => void;
  afterRouteChange(guard: AfterRouteChangeGuard): () => void;
}
```

Detects URL changes and mounts/unmounts MFEs. Patches History API to intercept pushState/replaceState. Supports route guards and baseUrl prefix stripping.

### `TimeoutError`

```ts
class TimeoutError extends Error {
  readonly timeout: number;
  constructor(timeout: number);
}
```

Error thrown when an operation exceeds the specified timeout.

### `CircuitOpenError`

```ts
class CircuitOpenError extends Error
```

Error thrown when the circuit breaker is open and requests are blocked.

### `SharedVersionConflictError`

```ts
class SharedVersionConflictError extends Error {
  readonly moduleName: string;
  constructor(moduleName: string, message: string);
}
```

Error thrown when shared module version negotiation fails.

## Functions

### `loadImportMap`

```ts
function loadImportMap(options: LoaderOptions): Promise<ImportMap>;
```

Loads and applies an import map to the DOM. Skips injection if a native import map already exists. Optionally injects modulepreload hints.

### `createDefaultFallback`

```ts
function createDefaultFallback(appName: string, error: Error, onRetry: () => void): HTMLElement;
```

Creates a default error fallback UI element with a retry button.

### `renderFallback`

```ts
function renderFallback(container: HTMLElement, content: HTMLElement | string): void;
```

Renders fallback content into a container element.

### `mountParcel`

```ts
function mountParcel(options: ParcelOptions): Promise<Parcel>;
```

Mounts an app to a DOM element independently of routing, creating a Parcel. Uses LifecycleRunner internally for state transitions.

### `createLifecycleRunner`

```ts
function createLifecycleRunner(options: LifecycleRunnerOptions): LifecycleRunner;
```

Creates a runner that safely executes MfeApp lifecycle with state transition guards and error handling.

### `createLifecycleHooks`

```ts
function createLifecycleHooks(options?: LifecycleHooksOptions): LifecycleHooks;
```

Creates a lifecycle hooks manager for registering and executing global and per-app before/after hooks.

### `createPrefetch`

```ts
function createPrefetch(options: PrefetchOptions): PrefetchController;
```

Creates a smart preloading controller. The `idle` strategy uses `requestIdleCallback`, and `immediate` executes right away.

### `withTimeout`

```ts
function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T>;
```

Applies a timeout to an async function. Throws `TimeoutError` if not completed within the specified time.

### `withRetry`

```ts
function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>;
```

Wraps an async function with retry capability. Retries on failure up to the specified count with a delay between each attempt.

### `withResilience`

```ts
function withResilience<T>(fn: () => Promise<T>, options: ResilienceOptions): Promise<T>;
```

Applies both timeout and retry to an async function. Each attempt has an independent timeout.

### `createCircuitBreaker`

```ts
function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker;
```

Creates a circuit breaker that opens on consecutive failures to block subsequent requests, then allows a trial request after cooldown.

### `parseSemver`

```ts
function parseSemver(version: string): SemverParts;
```

Parses a version string (e.g. `"18.3.1"`) into major, minor, and patch components.

### `compareVersions`

```ts
function compareVersions(a: string, b: string): -1 | 0 | 1;
```

Compares two semver version strings. Returns `-1`, `0`, or `1`.

### `satisfiesRange`

```ts
function satisfiesRange(version: string, range: string): boolean;
```

Checks whether a version satisfies a semver range. Supports `^`, `~`, `>=`, and exact match.

### `createSharedModuleRegistry`

```ts
function createSharedModuleRegistry(): SharedModuleRegistry;
```

Creates a shared module registry that negotiates versions of shared dependencies registered by multiple MFE apps, selects the optimal version, and shares a single instance.

### `createIntelligentPrefetch`

```ts
function createIntelligentPrefetch(
  options?: IntelligentPrefetchOptions,
): IntelligentPrefetchController;
```

Creates an intelligent prefetch controller that learns user navigation patterns to predict the next visited app and prioritize prefetching.

### `createResourceLoader`

```ts
function createResourceLoader(options?: ResourceLoaderOptions): ResourceLoader;
```

Creates a resource loading pipeline with staged interceptors for fetch, JS transformation, and CSS transformation with caching support.

### `createNamespaceGuard`

```ts
function createNamespaceGuard(options?: NamespaceGuardOptions): NamespaceGuard;
```

Creates a namespace conflict guard for global resources. Tracks ownership and prevents unintended overwrites between MFE apps.

## Types

### `LoaderOptions`

Either `importMapUrl` or `inlineImportMap` must be provided.

| Property          | Type        | Description                                             |
| ----------------- | ----------- | ------------------------------------------------------- |
| `importMapUrl`    | `string`    | URL to fetch the import map JSON from                   |
| `inlineImportMap` | `ImportMap` | Inline import map object                                |
| `injectPreload`   | `boolean`   | Whether to inject modulepreload hints (default: `true`) |

### `AppRegistryOptions`

| Property        | Type                   | Description                                       |
| --------------- | ---------------------- | ------------------------------------------------- |
| `importMap`     | `ImportMap`            | Import map for resolving bare specifiers to URLs  |
| `errorBoundary` | `ErrorBoundaryOptions` | Global error boundary options applied to all apps |

### `RegisterAppOptions`

| Property        | Type                                                    | Description                                       |
| --------------- | ------------------------------------------------------- | ------------------------------------------------- |
| `name`          | `string`                                                | App name (import map specifier)                   |
| `activeWhen`    | `string \| string[] \| (location: Location) => boolean` | Route matching function or pattern                |
| `container`     | `string`                                                | DOM selector for mount target (default: `"#app"`) |
| `errorBoundary` | `ErrorBoundaryOptions`                                  | Per-app error boundary overrides                  |

### `RouterOptions`

| Property    | Type                              | Description                                          |
| ----------- | --------------------------------- | ---------------------------------------------------- |
| `mode`      | `'history' \| 'hash'`             | Route change detection method (default: `'history'`) |
| `baseUrl`   | `string`                          | Base path prepended to all routes                    |
| `onNoMatch` | `(context: RouteContext) => void` | Handler called when no registered app matches        |

### `RouteContext`

| Property   | Type     | Description   |
| ---------- | -------- | ------------- |
| `pathname` | `string` | URL pathname  |
| `search`   | `string` | Query string  |
| `hash`     | `string` | Hash fragment |

### `ParcelOptions`

| Property     | Type                              | Description                  |
| ------------ | --------------------------------- | ---------------------------- |
| `app`        | `MfeApp \| () => Promise<MfeApp>` | App to mount or async loader |
| `domElement` | `HTMLElement`                     | Target DOM element           |
| `props`      | `Record<string, unknown>`         | Initial props                |

### `LifecyclePhase`

```ts
type LifecyclePhase = 'load' | 'bootstrap' | 'mount' | 'unmount' | 'update';
```

### `PrefetchStrategy`

```ts
type PrefetchStrategy = 'idle' | 'immediate';
```

### `PrefetchOptions`

| Property    | Type                                  | Description                           |
| ----------- | ------------------------------------- | ------------------------------------- |
| `strategy`  | `PrefetchStrategy`                    | Prefetch strategy                     |
| `apps`      | `PrefetchAppConfig[]`                 | List of apps to prefetch              |
| `importMap` | `{ imports: Record<string, string> }` | Import map for name-based prefetching |

### `RetryOptions`

| Property  | Type     | Description                |
| --------- | -------- | -------------------------- |
| `retries` | `number` | Maximum number of retries  |
| `delay`   | `number` | Delay between retries (ms) |

### `ResilienceOptions`

Extends `RetryOptions`.

| Property  | Type     | Description              |
| --------- | -------- | ------------------------ |
| `timeout` | `number` | Timeout per attempt (ms) |

### `CircuitBreakerOptions`

| Property           | Type                                             | Description                                      |
| ------------------ | ------------------------------------------------ | ------------------------------------------------ |
| `failureThreshold` | `number`                                         | Consecutive failures to open the circuit         |
| `cooldownMs`       | `number`                                         | Wait time (ms) before transitioning to half-open |
| `onStateChange`    | `(from: CircuitState, to: CircuitState) => void` | State transition callback                        |

### `SharedModuleConfig`

| Property          | Type                                     | Description                                  |
| ----------------- | ---------------------------------------- | -------------------------------------------- |
| `name`            | `string`                                 | Module name (e.g. `"react"`)                 |
| `version`         | `string`                                 | Provided version                             |
| `requiredVersion` | `string`                                 | Required semver range                        |
| `singleton`       | `boolean`                                | Whether to enforce a single instance         |
| `eager`           | `boolean`                                | Whether to load immediately at register time |
| `strictVersion`   | `boolean`                                | Whether to throw on version mismatch         |
| `factory`         | `() => Promise<unknown>`                 | Factory function that creates the module     |
| `fallback`        | `() => Promise<unknown>`                 | Fallback factory for version conflicts       |
| `subpaths`        | `Record<string, () => Promise<unknown>>` | Subpath exports mapping                      |
| `from`            | `string`                                 | Registrant app name                          |

### `IntelligentPrefetchOptions`

| Property      | Type     | Description                                                         |
| ------------- | -------- | ------------------------------------------------------------------- |
| `maxHistory`  | `number` | Max navigation records to keep (default: `200`)                     |
| `threshold`   | `number` | Minimum transition probability to trigger prefetch (default: `0.1`) |
| `maxPrefetch` | `number` | Max apps to prefetch (default: `3`)                                 |
| `persistKey`  | `string` | localStorage key for persisting learned data                        |

### `ResourceLoaderOptions`

| Property       | Type      | Description                                          |
| -------------- | --------- | ---------------------------------------------------- |
| `enableCache`  | `boolean` | Whether caching is enabled (default: `true`)         |
| `cacheTtl`     | `number`  | Cache TTL in ms (default: `300000`)                  |
| `fetchTimeout` | `number`  | Fetch timeout in ms (default: `30000`, `0` disables) |

### `NamespaceGuardOptions`

| Property            | Type                          | Description                                      |
| ------------------- | ----------------------------- | ------------------------------------------------ |
| `onConflict`        | `'warn' \| 'error' \| 'skip'` | Action on conflict detection (default: `'warn'`) |
| `allowedSharedKeys` | `string[]`                    | Keys that do not trigger conflicts               |
