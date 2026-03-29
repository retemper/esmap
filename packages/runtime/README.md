# @esmap/runtime

Browser runtime — import map loading, MFE lifecycle management, and routing.

The core package of the esmap framework.

## Installation

```bash
pnpm add @esmap/runtime
```

## Import Map Loading

Injects an import map into the browser. Supports URL or inline object.

```ts
import { loadImportMap } from '@esmap/runtime';

// Load from URL
await loadImportMap({ importMapUrl: 'https://cdn.example.com/importmap.json' });

// Inline import map
await loadImportMap({
  inlineImportMap: {
    imports: { '@myorg/checkout': 'https://cdn/checkout.js' },
    scopes: {},
  },
});

// Auto-inject preload hints
await loadImportMap({
  importMapUrl: 'https://cdn/importmap.json',
  injectPreload: true,
});
```

`importMapUrl` and `inlineImportMap` are mutually exclusive (discriminated union).

## AppRegistry

Handles MFE app registration, status management, and lifecycle execution.

```ts
import { AppRegistry } from '@esmap/runtime';

const registry = new AppRegistry({
  // Resolve bare specifiers via import map (optional)
  importMap: { imports: { '@myorg/checkout': 'https://cdn/checkout.js' }, scopes: {} },
  // Global error boundary (optional)
  errorBoundary: {
    retryLimit: 3,
    retryDelay: 1000,
    onError: (appName, error) => console.error(appName, error),
  },
});

// Register an app
registry.registerApp({
  name: '@myorg/checkout',
  activeWhen: '/checkout', // string, array, or function
  container: '#mfe-container', // DOM selector (default: '#app')
  errorBoundary: { retryLimit: 5 }, // per-app override
});

// Lifecycle
await registry.loadApp('@myorg/checkout'); // NOT_LOADED -> LOADING -> BOOTSTRAPPING -> NOT_MOUNTED
await registry.mountApp('@myorg/checkout'); // NOT_MOUNTED -> MOUNTED
await registry.unmountApp('@myorg/checkout'); // MOUNTED -> UNMOUNTING -> NOT_MOUNTED

// Subscribe to status changes
const unsubscribe = registry.onStatusChange(({ appName, from, to }) => {
  console.log(`${appName}: ${from} -> ${to}`);
});

// Query
registry.getApps(); // all apps
registry.getApp('@myorg/checkout'); // specific app

// Cleanup
await registry.destroy(); // unmount all mounted apps + clear registry
```

### Concurrent Load Deduplication

Simultaneous `loadApp()` calls for the same app share a single Promise:

```ts
// Both calls execute concurrently, but only one actual load happens
await Promise.all([registry.loadApp('@myorg/checkout'), registry.loadApp('@myorg/checkout')]);
```

## Router

Detects URL changes and mounts/unmounts the appropriate MFEs.

```ts
import { Router } from '@esmap/runtime';

const router = new Router(registry, { mode: 'history' }); // 'history' | 'hash'

// Route guards
const removeGuard = router.beforeRouteChange(async (from, to) => {
  if (hasUnsavedChanges()) return false; // false cancels navigation
  return true;
});

router.afterRouteChange((from, to) => {
  analytics.pageView(to.pathname);
});

await router.start();

// Remove guard
removeGuard();

// Stop
router.stop();
```

When `beforeRouteChange` returns false, navigation is cancelled and the URL is restored.
Rapid consecutive navigations automatically invalidate stale operations (race condition prevention).

## Parcel

Programmatically mount an unregistered MFE:

```ts
import { mountParcel } from '@esmap/runtime';

const parcel = await mountParcel({
  specifier: '@myorg/widget',
  container: document.getElementById('widget-slot')!,
  props: { theme: 'dark' },
});

// Update props
await parcel.update({ theme: 'light' });

// Unmount
await parcel.unmount();
```

## Lifecycle Hooks

Inject shared logic into lifecycle phases:

```ts
import { createLifecycleHooks } from '@esmap/runtime';

const hooks = createLifecycleHooks();

hooks.beforeEach('mount', async (context) => {
  console.log(`${context.appName} mount starting`);
});

hooks.afterEach('unmount', async (context) => {
  console.log(`${context.appName} unmount complete`);
});
```

## Prefetch

Preload MFEs during idle time:

```ts
import { createPrefetch } from '@esmap/runtime';

const prefetch = createPrefetch({
  strategy: 'idle',
  apps: [
    { name: '@myorg/checkout', priority: 1 },
    { name: '@myorg/settings', priority: 2 },
  ],
});

prefetch.start();
prefetch.stop();
```

## Resilience

Timeout, retry, and resilience utilities:

```ts
import { withTimeout, withRetry, withResilience, TimeoutError } from '@esmap/runtime';

// 5-second timeout (first argument is a function, not a promise)
const result = await withTimeout(() => fetchData(), 5000);

// Up to 3 retries with delay
const data = await withRetry(() => fetchData(), { retries: 3, delay: 1000 });

// Timeout + retry combined
const resilientData = await withResilience(() => fetchData(), {
  timeout: 5000,
  retries: 3,
  delay: 1000,
});
```

## Semver

Semver utilities used for shared dependency version negotiation:

```ts
import { parseSemver, compareVersions, satisfiesRange } from '@esmap/runtime';

parseSemver('1.2.3'); // { major: 1, minor: 2, patch: 3, prerelease: undefined }
compareVersions('1.2.0', '1.3.0'); // -1
satisfiesRange('1.2.3', '^1.0.0'); // true
```

## Shared Module Registry

Version negotiation for shared modules across MFEs:

```ts
import { createSharedModuleRegistry } from '@esmap/runtime';

const shared = createSharedModuleRegistry();

shared.register({
  name: 'react',
  version: '18.2.0',
  url: 'https://cdn/react-18.2.0.js',
  requiredRange: '^18.0.0',
});

const resolved = shared.resolve('react', '^18.0.0');
```
