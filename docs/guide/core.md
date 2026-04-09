# Unified Kernel

`@esmap/core` provides `createEsmap`, the single entry point that wires together every subsystem of the framework — registry, router, lifecycle hooks, performance tracking, prefetching, shared modules, and plugins — into one cohesive instance.

## Basic Usage

```ts
import { createEsmap } from '@esmap/core';

const esmap = createEsmap({
  config: {
    apps: {
      header: { path: '/', container: '#header' },
      dashboard: { path: '/dashboard', container: '#main' },
      settings: { path: '/settings', container: '#main' },
    },
    shared: {
      react: { requiredVersion: '^18.0.0', singleton: true, eager: true },
      'react-dom': { requiredVersion: '^18.0.0', singleton: true },
    },
  },
  importMap: {
    imports: {
      header: '/apps/header/esmap-manifest.json',
      dashboard: '/apps/dashboard/esmap-manifest.json',
      settings: '/apps/settings/esmap-manifest.json',
    },
  },
  router: { baseUrl: '/' },
});

await esmap.start();
```

## What `createEsmap` Does

Calling `createEsmap(options)` performs the following in order:

1. Creates an **AppRegistry** with the provided import map and registers every app from `config.apps`.
2. Creates a **Router** linked to the registry.
3. Creates **LifecycleHooks** and connects them to registry status transitions (load, bootstrap, mount, unmount).
4. Creates a **PerfTracker** and, unless `disablePerf` is set, installs automatic performance instrumentation on all lifecycle phases.
5. Creates a **PrefetchController** from the app list and import map.
6. Creates a **SharedModuleRegistry** and registers all dependencies from `config.shared`.
7. Installs **devtools** unless `disableDevtools` is set.
8. Installs **plugins** in order, collecting their cleanup functions.
9. Returns an `EsmapInstance`.

## EsmapOptions

| Property | Type | Description |
|---|---|---|
| `config` | `EsmapConfig` | App list, shared dependencies, CDN base, etc. **Required.** |
| `importMap` | `ImportMap` | Loaded inline or resolved from a URL. |
| `router` | `RouterOptions` | `baseUrl`, `onNoMatch`, and other router settings. |
| `disablePerf` | `boolean` | Disable automatic performance tracking. Default `false`. |
| `disableDevtools` | `boolean` | Disable devtools integration. Default `false`. |
| `plugins` | `EsmapPlugin[]` | Plugins executed in install order, cleaned up in reverse during `destroy()`. |

## EsmapInstance

The returned instance exposes every subsystem plus two lifecycle methods:

| Property | Type | Description |
|---|---|---|
| `registry` | `AppRegistry` | Registers, loads, mounts, and unmounts apps. |
| `router` | `Router` | URL-based app activation. |
| `hooks` | `LifecycleHooks` | Before/after hooks for load, bootstrap, mount, unmount, update. |
| `perf` | `PerfTracker` | Automatic lifecycle instrumentation. |
| `prefetch` | `PrefetchController` | Resource prefetching controller. |
| `sharedModules` | `SharedModuleRegistry` | Dependency sharing and version negotiation between MFEs. |
| `start()` | `Promise<void>` | Waits for eager shared modules, starts prefetching, starts the router, and handles the initial route. |
| `destroy()` | `Promise<void>` | Stops the router and prefetcher, runs plugin cleanups in reverse order, unmounts all apps, and clears performance data. |

## Plugin System

Plugins extend the framework by hooking into any subsystem through `PluginContext`.

```ts
import type { EsmapPlugin, PluginContext, PluginCleanup } from '@esmap/core';

const loggingPlugin: EsmapPlugin = {
  name: 'my:logging',

  install(ctx: PluginContext): PluginCleanup {
    ctx.hooks.afterEach('mount', (hookCtx) => {
      console.log(`${hookCtx.appName} mounted`);
    });

    ctx.hooks.afterEach('unmount', (hookCtx) => {
      console.log(`${hookCtx.appName} unmounted`);
    });

    return () => {
      console.log('logging plugin cleaned up');
    };
  },
};

const esmap = createEsmap({
  config,
  plugins: [loggingPlugin],
});
```

The `PluginContext` provides access to `registry`, `router`, `hooks`, `perf`, and `prefetch`. If the `install` method returns a cleanup function, it runs automatically during `destroy()`. Cleanups execute in reverse installation order to prevent dependency issues.

Duplicate plugin names throw an error at install time.

## Built-in Plugins

All built-in plugins are exported from `@esmap/core`.

### `guardPlugin`

CSS scoping and global pollution detection. Automatically applies isolation on mount and cleans up on unmount.

```ts
import { createEsmap, guardPlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    guardPlugin({
      cssStrategy: 'attribute',    // 'attribute' | 'shadow'
      observeDynamic: true,        // watch for dynamic style additions
      detectGlobalPollution: true, // detect window property pollution
      globalAllowList: ['__MY_GLOBAL__'],
      onGlobalViolation: (appName, property) => {
        console.warn(`${appName} polluted window.${property}`);
      },
    }),
  ],
});
```

### `sandboxPlugin`

Proxy-based JavaScript sandbox. Activates a `ProxySandbox` per app on mount and deactivates on unmount, isolating `window` property modifications.

```ts
import { createEsmap, sandboxPlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    sandboxPlugin({
      allowList: ['__webpack_public_path__'],
      exclude: ['shell-app'],  // skip sandboxing for trusted apps
    }),
  ],
});
```

### `communicationPlugin`

Type-safe inter-app communication via `EventBus` and `GlobalState`. Returns `{ plugin, resources }` so you can access the event bus and state outside the plugin lifecycle.

```ts
import { createEsmap, communicationPlugin } from '@esmap/core';

interface MyEvents {
  'user:login': { id: string };
  'user:logout': undefined;
}

interface MyState {
  user: { name: string } | null;
}

const comm = communicationPlugin<MyEvents, MyState>({
  maxEventHistory: 50,
  initialState: { user: null },
  onEventError: (event, error) => console.error(event, error),
});

const esmap = createEsmap({
  config,
  plugins: [comm.plugin],
});

// Use from anywhere
comm.resources.eventBus.emit('user:login', { id: '123' });
comm.resources.globalState.set('user', { name: 'Alice' });
```

### `keepAlivePlugin`

Preserves DOM state during route transitions for designated apps. Instead of unmounting, the container is hidden (FROZEN state) and instantly restored on revisit. Scroll positions, form values, and component state are all preserved.

```ts
import { createEsmap, keepAlivePlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    keepAlivePlugin({
      apps: ['dashboard', 'settings'],  // required
      maxCached: 3,  // LRU eviction when exceeded; default Infinity
    }),
  ],
});
```

### `domIsolationPlugin`

Scopes `document.querySelector` and similar DOM query methods to the app's container on mount. Prevents apps from accidentally querying elements outside their boundary.

```ts
import { createEsmap, domIsolationPlugin } from '@esmap/core';

const esmap = createEsmap({
  config,
  plugins: [
    domIsolationPlugin({
      exclude: ['gnb'],  // apps that need full document access
      globalSelectors: ['#global-modal', '[data-esmap-global]'],
    }),
  ],
});
```

### `intelligentPrefetchPlugin`

Predictive prefetching based on navigation patterns. Records route transitions and prefetches apps that are likely to be visited next. Returns `{ plugin, controller }` for external access to learning data.

```ts
import { createEsmap, intelligentPrefetchPlugin } from '@esmap/core';

const prefetch = intelligentPrefetchPlugin({
  prefetchDelay: 1000,  // ms after navigation before prefetching
  excludeContainers: ['#header'],  // ignore when determining current app
});

const esmap = createEsmap({
  config,
  plugins: [prefetch.plugin],
});

// Inspect learned priorities
const priorities = prefetch.controller.getPriorities('dashboard');
```

## Combining Plugins

Plugins execute in the order they are listed. Place isolation plugins before communication plugins to ensure the sandbox is active when events fire.

```ts
import {
  createEsmap,
  guardPlugin,
  sandboxPlugin,
  communicationPlugin,
  keepAlivePlugin,
  domIsolationPlugin,
  intelligentPrefetchPlugin,
} from '@esmap/core';

const comm = communicationPlugin({ initialState: { theme: 'light' } });
const prefetch = intelligentPrefetchPlugin({ prefetchDelay: 2000 });

const esmap = createEsmap({
  config,
  importMap,
  plugins: [
    guardPlugin({ cssStrategy: 'attribute' }),
    sandboxPlugin({ exclude: ['shell'] }),
    domIsolationPlugin({ exclude: ['shell'] }),
    comm.plugin,
    keepAlivePlugin({ apps: ['dashboard'], maxCached: 5 }),
    prefetch.plugin,
  ],
});

await esmap.start();
```

## Teardown

Call `destroy()` to fully clean up:

```ts
await esmap.destroy();
```

This stops the router and prefetcher, runs every plugin cleanup in reverse installation order, unmounts all apps, and clears performance data.
