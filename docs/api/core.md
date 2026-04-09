# @esmap/core

The unified kernel that wires together every esmap subsystem — registry, router, lifecycle hooks, performance tracking, prefetching, shared modules — and provides a plugin system for extensibility.

## Installation

```bash
pnpm add @esmap/core
```

`@esmap/core` depends on `@esmap/runtime`, `@esmap/monitor`, `@esmap/shared`, `@esmap/guard`, `@esmap/sandbox`, `@esmap/communication`, and `@esmap/devtools`. These are installed automatically as dependencies.

## Functions

### `createEsmap`

Creates the integrated kernel instance.

```ts
function createEsmap(options: EsmapOptions): EsmapInstance;
```

Creates and connects `AppRegistry`, `Router`, `LifecycleHooks`, `PerfTracker`, `PrefetchController`, and `SharedModuleRegistry`. Registers all apps from `config.apps`, installs plugins in order, and returns an `EsmapInstance` with `start()` and `destroy()` methods.

### `installAutoPerf`

Connects `PerfTracker` to `LifecycleHooks` for automatic instrumentation.

```ts
function installAutoPerf(hooks: LifecycleHooks, perf: PerfTracker): void;
```

Registers before/after hooks on all tracked lifecycle phases (`load`, `bootstrap`, `mount`, `unmount`, `update`) to call `perf.markStart` and `perf.markEnd` automatically.

### `installPlugins`

Installs a list of plugins in order and collects cleanup functions.

```ts
function installPlugins(
  plugins: readonly EsmapPlugin[],
  ctx: PluginContext,
): readonly PluginCleanup[];
```

Throws an error if a duplicate plugin name is detected.

### `runCleanups`

Executes cleanup functions in reverse order.

```ts
function runCleanups(cleanups: readonly PluginCleanup[]): Promise<void>;
```

Runs cleanups in reverse installation order to prevent dependency issues.

## Built-in Plugins

### `guardPlugin`

CSS scoping and global pollution detection.

```ts
function guardPlugin(options?: GuardPluginOptions): EsmapPlugin;
```

Automatically applies CSS isolation and global guards on app mount, and cleans up on unmount.

### `sandboxPlugin`

Proxy-based JavaScript sandbox.

```ts
function sandboxPlugin(options?: SandboxPluginOptions): EsmapPlugin;
```

Activates a `ProxySandbox` per app on mount and deactivates on unmount.

### `communicationPlugin`

Type-safe inter-app communication.

```ts
function communicationPlugin<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
>(
  options?: CommunicationPluginOptions<TEvents, TState>,
): { readonly plugin: EsmapPlugin; readonly resources: CommunicationResources<TEvents, TState> };
```

Returns `{ plugin, resources }` where `resources` provides access to the `EventBus` and `GlobalState`.

### `keepAlivePlugin`

DOM state preservation during route transitions.

```ts
function keepAlivePlugin(options: KeepAlivePluginOptions): EsmapPlugin;
```

Hides containers instead of unmounting (FROZEN state) and restores them instantly on revisit. Uses LRU eviction when `maxCached` is exceeded.

### `domIsolationPlugin`

Scopes DOM query methods to app containers.

```ts
function domIsolationPlugin(options?: DomIsolationPluginOptions): EsmapPlugin;
```

Scopes `document.querySelector` and similar methods to the app's container on mount.

### `intelligentPrefetchPlugin`

Predictive prefetching based on navigation patterns.

```ts
function intelligentPrefetchPlugin(
  options?: IntelligentPrefetchPluginOptions,
): IntelligentPrefetchPluginResult;
```

Returns `{ plugin, controller }` where `controller` provides access to learned navigation priorities.

## Types

### `EsmapOptions`

```ts
interface EsmapOptions {
  readonly config: EsmapConfig;
  readonly importMap?: ImportMap;
  readonly router?: RouterOptions;
  readonly disablePerf?: boolean;
  readonly disableDevtools?: boolean;
  readonly plugins?: readonly EsmapPlugin[];
}
```

| Property          | Type                     | Description                                                                  |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `config`          | `EsmapConfig`            | App list, shared dependencies, CDN base, etc. **Required.**                  |
| `importMap`       | `ImportMap`              | Loaded inline or resolved from a URL.                                        |
| `router`          | `RouterOptions`          | `baseUrl`, `onNoMatch`, and other router settings.                           |
| `disablePerf`     | `boolean`                | Disable automatic performance tracking. Default `false`.                     |
| `disableDevtools` | `boolean`                | Disable devtools integration. Default `false`.                               |
| `plugins`         | `readonly EsmapPlugin[]` | Plugins executed in install order, cleaned up in reverse during `destroy()`. |

### `EsmapInstance`

```ts
interface EsmapInstance {
  readonly registry: AppRegistry;
  readonly router: Router;
  readonly hooks: LifecycleHooks;
  readonly perf: PerfTracker;
  readonly prefetch: PrefetchController;
  readonly sharedModules: SharedModuleRegistry;
  start(): Promise<void>;
  destroy(): Promise<void>;
}
```

### `EsmapPlugin`

```ts
interface EsmapPlugin {
  readonly name: string;
  install(ctx: PluginContext): PluginCleanup | void;
}
```

### `PluginContext`

```ts
interface PluginContext {
  readonly registry: AppRegistry;
  readonly router: Router;
  readonly hooks: LifecycleHooks;
  readonly perf: PerfTracker;
  readonly prefetch: PrefetchController;
}
```

### `PluginCleanup`

```ts
type PluginCleanup = () => void | Promise<void>;
```

### `GuardPluginOptions`

```ts
interface GuardPluginOptions {
  readonly cssStrategy?: 'attribute' | 'shadow';
  readonly observeDynamic?: boolean;
  readonly detectGlobalPollution?: boolean;
  readonly globalAllowList?: readonly string[];
  readonly onGlobalViolation?: (appName: string, property: string) => void;
}
```

| Property                | Type                                          | Default       | Description                                             |
| ----------------------- | --------------------------------------------- | ------------- | ------------------------------------------------------- |
| `cssStrategy`           | `'attribute' \| 'shadow'`                     | `'attribute'` | CSS isolation strategy.                                 |
| `observeDynamic`        | `boolean`                                     | `true`        | Watch for dynamic style additions via MutationObserver. |
| `detectGlobalPollution` | `boolean`                                     | `true`        | Enable global pollution detection.                      |
| `globalAllowList`       | `readonly string[]`                           | `[]`          | Properties to exclude from pollution detection.         |
| `onGlobalViolation`     | `(appName: string, property: string) => void` | —             | Callback invoked on pollution detection.                |

### `SandboxPluginOptions`

```ts
interface SandboxPluginOptions {
  readonly allowList?: readonly PropertyKey[];
  readonly exclude?: readonly string[];
}
```

| Property    | Type                     | Default               | Description                           |
| ----------- | ------------------------ | --------------------- | ------------------------------------- |
| `allowList` | `readonly PropertyKey[]` | ProxySandbox defaults | Proxy sandbox allow list.             |
| `exclude`   | `readonly string[]`      | `[]`                  | App names to exclude from sandboxing. |

### `CommunicationPluginOptions`

```ts
interface CommunicationPluginOptions<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly maxEventHistory?: number;
  readonly initialState?: TState;
  readonly onEventError?: (event: string, error: unknown) => void;
  readonly _events?: TEvents;
}
```

| Property          | Type                                      | Default | Description                                            |
| ----------------- | ----------------------------------------- | ------- | ------------------------------------------------------ |
| `maxEventHistory` | `number`                                  | `100`   | Maximum event history entries to retain.               |
| `initialState`    | `TState`                                  | `{}`    | Initial global state value.                            |
| `onEventError`    | `(event: string, error: unknown) => void` | —       | Event handler error callback.                          |
| `_events`         | `TEvents`                                 | —       | Type-only event map for inference (no runtime effect). |

### `CommunicationResources`

```ts
interface CommunicationResources<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly eventBus: EventBus<TEvents>;
  readonly globalState: GlobalState<TState>;
}
```

### `KeepAlivePluginOptions`

```ts
interface KeepAlivePluginOptions {
  readonly apps: readonly string[];
  readonly maxCached?: number;
}
```

| Property    | Type                | Default    | Description                                                      |
| ----------- | ------------------- | ---------- | ---------------------------------------------------------------- |
| `apps`      | `readonly string[]` | —          | App names to apply keep-alive to. **Required.**                  |
| `maxCached` | `number`            | `Infinity` | Maximum cached apps. Oldest FROZEN app is evicted when exceeded. |

### `DomIsolationPluginOptions`

```ts
interface DomIsolationPluginOptions {
  readonly exclude?: readonly string[];
  readonly globalSelectors?: readonly string[];
}
```

| Property          | Type                | Default | Description                                      |
| ----------------- | ------------------- | ------- | ------------------------------------------------ |
| `exclude`         | `readonly string[]` | `[]`    | App names to exclude from DOM isolation.         |
| `globalSelectors` | `readonly string[]` | `[]`    | Selector patterns that bypass container scoping. |

### `IntelligentPrefetchPluginOptions`

```ts
interface IntelligentPrefetchPluginOptions extends IntelligentPrefetchOptions {
  readonly prefetchDelay?: number;
  readonly excludeContainers?: readonly string[];
}
```

| Property            | Type                | Default | Description                                                      |
| ------------------- | ------------------- | ------- | ---------------------------------------------------------------- |
| `prefetchDelay`     | `number`            | `1000`  | Delay (ms) after navigation before starting prefetch.            |
| `excludeContainers` | `readonly string[]` | `[]`    | Container selectors to exclude when determining the current app. |

### `IntelligentPrefetchPluginResult`

```ts
interface IntelligentPrefetchPluginResult {
  readonly plugin: EsmapPlugin;
  readonly controller: IntelligentPrefetchController;
}
```
