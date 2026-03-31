<p align="center">
  <h1 align="center">esmap</h1>
  <p align="center">
    The import map framework for micro-frontends.
  </p>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="#packages"><img src="https://img.shields.io/badge/packages-15-orange" alt="15 packages" /></a>
</p>

---

Build-time import map generation, browser runtime, deployment server, and developer tools — everything you need to run micro-frontends, in one framework.

## Why esmap?

Most MFE solutions couple you to a specific bundler or invent custom module protocols. esmap builds on **W3C Import Maps**, a browser-native standard, so your MFEs are just ESM modules that the browser resolves natively.

|                     | **Module Federation**               | **single-spa**         | **qiankun**             | **esmap**                                     |
| ------------------- | ----------------------------------- | ---------------------- | ----------------------- | --------------------------------------------- |
| **Standard**        | Webpack-specific container protocol | None (custom loader)   | None (wraps single-spa) | **W3C Import Maps**                           |
| **Bundler**         | Webpack only                        | Any (no build opinion) | Any (no build opinion)  | **Any** (Vite plugin included)                |
| **Module format**   | Webpack chunks                      | SystemJS or ESM        | SystemJS (UMD compat)   | **Native ESM**                                |
| **Routing**         | Manual                              | Built-in               | Built-in                | **Built-in** (guards, race-condition safe)    |
| **JS isolation**    | None                                | None                   | Proxy sandbox           | **Proxy + Snapshot sandbox**                  |
| **CSS isolation**   | None                                | None                   | Shadow DOM / scoped     | **Scoped CSS + global pollution detection**   |
| **Shared deps**     | Implicit (shared config)            | Manual                 | Manual                  | **Explicit import map + version negotiation** |
| **Server**          | None                                | None                   | None                    | **Built-in** (deploy API, rollback, history)  |
| **Devtools**        | None                                | single-spa-inspector   | None                    | **Built-in** (import map override)            |
| **Deploy coupling** | Build-time (remoteEntry.js)         | Build-time             | Build-time              | **Deploy-time** (independent deploys)         |

## Quick Start

### 1. Write a micro-frontend

Each MFE exports three lifecycle functions:

```ts
// apps/checkout/src/index.ts
export async function bootstrap() {}

export async function mount(container: HTMLElement) {
  container.innerHTML = '<div>Checkout App</div>';
}

export async function unmount(container: HTMLElement) {
  container.innerHTML = '';
}
```

For React apps:

```tsx
import { createReactMfeApp } from '@esmap/react';
import { App } from './App';

export const { bootstrap, mount, unmount } = createReactMfeApp({
  rootComponent: App,
});
```

### 2. Configure the build

```ts
// vite.config.ts
import { esmapManifest, esmapSharedDeps } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({ name: '@myorg/checkout' }),
    esmapSharedDeps({ react: '^18.0.0', 'react-dom': '^18.0.0' }),
  ],
  build: { lib: { entry: 'src/index.ts', formats: ['es'] } },
});
```

### 3. Set up the host

```ts
import { loadImportMap, AppRegistry, Router } from '@esmap/runtime';

await loadImportMap({ importMapUrl: '/importmap.json' });

const registry = new AppRegistry();
registry.registerApp({
  name: '@myorg/checkout',
  activeWhen: '/checkout',
  container: '#mfe-root',
});

const router = new Router(registry);
await router.start();
```

### 4. Deploy

```bash
# Start the import map server
esmap serve --port 3000

# Deploy a new version
esmap deploy --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js

# Rollback if needed
esmap rollback --server http://localhost:3000 --name @myorg/checkout
```

## Packages

### Browser

| Package                                            | Size (gzip) | Description                                                                   |
| -------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| [`@esmap/runtime`](./packages/runtime)             | 8.2 kB      | Import map loader, app registry, router, error boundary, prefetch, resilience |
| [`@esmap/react`](./packages/react)                 | 1.5 kB      | React adapter — `createReactMfeApp()`, hooks, `<EsmapParcel>`                 |
| [`@esmap/communication`](./packages/communication) | 1.1 kB      | Event bus, global state, app props                                            |
| [`@esmap/sandbox`](./packages/sandbox)             | 1.9 kB      | Proxy sandbox, snapshot sandbox                                               |
| [`@esmap/guard`](./packages/guard)                 | 2.7 kB      | CSS scoping, global pollution detection, style isolation                      |
| [`@esmap/devtools`](./packages/devtools)           | 1.0 kB      | Import map override for local development                                     |
| [`@esmap/monitor`](./packages/monitor)             | 1.1 kB      | Performance tracking per lifecycle phase                                      |

**Total browser runtime: ~17.5 kB gzipped** (runtime + react + communication + sandbox + guard + devtools + monitor)

### Build / Server

| Package                                        | Description                                               |
| ---------------------------------------------- | --------------------------------------------------------- |
| [`@esmap/cli`](./packages/cli)                 | CLI — generate, deploy, rollback                          |
| [`@esmap/vite-plugin`](./packages/vite-plugin) | Vite plugin — manifest generation, ESM externals          |
| [`@esmap/server`](./packages/server)           | Import map server — deploy API, rollback, history         |
| [`@esmap/config`](./packages/config)           | Configuration schema, loading, validation                 |
| [`@esmap/compat`](./packages/compat)           | Migration layer — Webpack Module Federation → import maps |

### Foundation

| Package                              | Description                                                  |
| ------------------------------------ | ------------------------------------------------------------ |
| [`@esmap/shared`](./packages/shared) | Shared types, errors, import map utilities                   |
| [`@esmap/test`](./packages/test)     | Test utilities — mock apps, test registry, harness, matchers |

## Architecture

```
Browser
┌──────────────────────────────────────────────────────────┐
│  runtime ──── react        sandbox    guard              │
│  (loader,     (adapter,    (JS        (CSS               │
│   router,      hooks,       isolation)  isolation)        │
│   registry)    Parcel)                                    │
│       │           │                                       │
│  communication    devtools        monitor                 │
│  (event bus,      (import map     (perf                   │
│   global state)    overrides)      tracking)              │
└──────────────────────────────────────────────────────────┘

Build / Server
┌──────────────────────────────────────────────────────────┐
│  cli          vite-plugin     server       compat        │
│  (generate,   (manifest,      (deploy API, (MF →         │
│   deploy)      externals)      storage)     import map)  │
│                      │                                    │
│  config (schema, loading, validation)                     │
└──────────────────────────────────────────────────────────┘

Foundation
┌──────────────────────────────────────────────────────────┐
│  shared (types, errors, import map utilities)             │
│  test (mock apps, test registry, matchers)                │
└──────────────────────────────────────────────────────────┘
```

**Dependency direction:** Application → `react` → `runtime` → `shared`. Packages like `sandbox`, `guard`, `communication`, `monitor` have **zero dependencies** — use only what you need.

## Key Features

### Race-condition-safe routing

The router tracks a `navigationVersion` counter. When rapid navigations occur, stale mount/unmount operations are automatically discarded:

```ts
const router = new Router(registry);

// Guards can cancel navigation
router.beforeRouteChange(async (from, to) => {
  if (hasUnsavedChanges()) return false;
  return true;
});

// After guards run post-mount
router.afterRouteChange((from, to) => {
  analytics.pageView(to.pathname);
});
```

### Concurrent load deduplication

Multiple simultaneous calls to `loadApp()` share a single Promise:

```ts
// Only one network request, both callers get the same result
await Promise.all([registry.loadApp('@myorg/checkout'), registry.loadApp('@myorg/checkout')]);
```

### Type-safe event bus

```ts
type Events = {
  'user:login': { userId: string };
  'cart:update': { items: number };
};

const bus = createEventBus<Events>();
bus.on('user:login', (payload) => {
  payload.userId; // string — type-safe
});
```

Handler errors are isolated — one failing handler doesn't block others.

### Import map override for development

Test local MFE builds against production without deploying:

```ts
installDevtoolsApi();

// In browser console:
__ESMAP__.setOverride('@myorg/checkout', 'http://localhost:5173/src/index.ts');
// Refresh → checkout loads from local dev server, everything else from production
```

## Development

### Prerequisites

- Node.js >= 22
- pnpm >= 10

### Setup

```bash
git clone <repository-url>
cd esmap
pnpm install
```

### Commands

```bash
pnpm build          # Build all packages
pnpm test           # Run all unit tests
pnpm type-check     # TypeScript validation
pnpm lint           # Lint
pnpm format         # Format with Prettier

# Single package
pnpm turbo test --filter=@esmap/runtime
```

### Examples

```bash
# Basic: import map generation pipeline
cd examples/basic && pnpm demo

# Multi-MFE: browser routing + dynamic loading + full integration
cd examples/multi-mfe && pnpm dev
```

## Test Coverage

- Unit tests across 15 packages (Vitest)
- All turbo tasks pass: type-check, test, build, lint

## Contributing

We welcome contributions! Please see:

- [**CONTRIBUTING.md**](./CONTRIBUTING.md) — Setup, development workflow, PR guidelines
- [**Code of Conduct**](./CODE_OF_CONDUCT.md) — Community standards
- [**Security Policy**](./SECURITY.md) — Reporting vulnerabilities

## License

[MIT](./LICENSE)
