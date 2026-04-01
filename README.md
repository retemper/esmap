<p align="center">
  <br />
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/retemper/esmap/main/.github/logo-dark.svg">
    <img src="https://raw.githubusercontent.com/retemper/esmap/main/.github/logo-light.svg" width="360" alt="esmap">
  </picture>
  <br />
  <br />
  <strong>Micro-frontends on native import maps.</strong>
  <br />
  Build-time generation, browser runtime, deploy server, and devtools — one framework.
  <br />
  <br />
  <a href="https://www.npmjs.com/package/@esmap/runtime"><img src="https://img.shields.io/npm/v/@esmap/runtime?style=flat&colorA=18181b&colorB=28cf8d" alt="npm version" /></a>
  <a href="https://github.com/retemper/esmap/actions"><img src="https://img.shields.io/github/actions/workflow/status/retemper/esmap/ci.yml?branch=main&style=flat&colorA=18181b" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat&colorA=18181b" alt="License" /></a>
</p>

<br />

## Getting Started

Install the packages you need:

```bash
pnpm add @esmap/runtime @esmap/react
pnpm add -D @esmap/vite-plugin @esmap/cli
```

## Quick Start

**1. Write a micro-frontend**

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

Or with React:

```tsx
import { createReactMfeApp } from '@esmap/react';
import { App } from './App';

export const { bootstrap, mount, unmount } = createReactMfeApp({
  rootComponent: App,
});
```

**2. Configure the build**

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

**3. Set up the host**

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

**4. Deploy**

```bash
esmap serve --port 3000

esmap deploy --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js

# Rollback if needed
esmap rollback --server http://localhost:3000 --name @myorg/checkout
```

## Why esmap?

Most micro-frontend solutions couple you to a specific bundler or invent custom module protocols. **esmap** builds on [W3C Import Maps](https://wicg.github.io/import-maps/) — a browser-native standard — so your MFEs are just ESM modules that the browser resolves natively.

- **Any bundler** — Vite plugin included, but not required
- **Independent deploys** — update one MFE without rebuilding the host
- **JS + CSS isolation** — proxy sandbox, scoped styles, global pollution detection
- **Race-condition-safe routing** — stale navigations are automatically discarded
- **Type-safe communication** — event bus with full TypeScript inference
- **~17.5 kB gzip total** — use only what you need, each package has zero cross-deps

<br />

<table>
<thead><tr><th></th><th>Module Federation</th><th>single-spa</th><th>qiankun</th><th>esmap</th></tr></thead>
<tbody>
<tr><td><strong>Standard</strong></td><td>Webpack-specific</td><td>Custom loader</td><td>Wraps single-spa</td><td>W3C Import Maps</td></tr>
<tr><td><strong>Bundler</strong></td><td>Webpack only</td><td>Any</td><td>Any</td><td>Any</td></tr>
<tr><td><strong>Module format</strong></td><td>Webpack chunks</td><td>SystemJS / ESM</td><td>SystemJS</td><td>Native ESM</td></tr>
<tr><td><strong>JS isolation</strong></td><td>None</td><td>None</td><td>Proxy sandbox</td><td>Proxy + Snapshot</td></tr>
<tr><td><strong>CSS isolation</strong></td><td>None</td><td>None</td><td>Shadow DOM</td><td>Scoped + detection</td></tr>
<tr><td><strong>Deploy server</strong></td><td>None</td><td>None</td><td>None</td><td>Built-in</td></tr>
<tr><td><strong>Devtools</strong></td><td>None</td><td>Inspector</td><td>None</td><td>Built-in</td></tr>
<tr><td><strong>Deploy coupling</strong></td><td>Build-time</td><td>Build-time</td><td>Build-time</td><td>Deploy-time</td></tr>
</tbody>
</table>

## Packages

### Browser

| Package                                            | Size (gzip) | Description                                                       |
| -------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| [`@esmap/runtime`](./packages/runtime)             | 8.2 kB      | Import map loader, app registry, router, error boundary, prefetch |
| [`@esmap/react`](./packages/react)                 | 1.5 kB      | React adapter — `createReactMfeApp()`, hooks, `<EsmapParcel>`     |
| [`@esmap/communication`](./packages/communication) | 1.1 kB      | Type-safe event bus, global state, app props                      |
| [`@esmap/sandbox`](./packages/sandbox)             | 1.9 kB      | Proxy sandbox, snapshot sandbox                                   |
| [`@esmap/guard`](./packages/guard)                 | 2.7 kB      | CSS scoping, global pollution detection                           |
| [`@esmap/devtools`](./packages/devtools)           | 1.0 kB      | Import map override for local development                         |
| [`@esmap/monitor`](./packages/monitor)             | 1.1 kB      | Performance tracking per lifecycle phase                          |

### Build & Server

| Package                                        | Description                                                |
| ---------------------------------------------- | ---------------------------------------------------------- |
| [`@esmap/cli`](./packages/cli)                 | CLI — generate, deploy, rollback                           |
| [`@esmap/vite-plugin`](./packages/vite-plugin) | Vite plugin — manifest generation, ESM externals           |
| [`@esmap/server`](./packages/server)           | Import map server — deploy API, rollback, history          |
| [`@esmap/config`](./packages/config)           | Configuration schema, loading, validation                  |
| [`@esmap/compat`](./packages/compat)           | Migration layer — Webpack Module Federation to import maps |

### Foundation

| Package                              | Description                                                  |
| ------------------------------------ | ------------------------------------------------------------ |
| [`@esmap/shared`](./packages/shared) | Shared types, errors, import map utilities                   |
| [`@esmap/test`](./packages/test)     | Test utilities — mock apps, test registry, harness, matchers |

## Architecture

```
Browser
┌──────────────────────────────────────────────────────────────┐
│  runtime ──── react        sandbox         guard             │
│  (loader,     (adapter,    (JS isolation)  (CSS isolation)   │
│   router,      hooks,                                        │
│   registry)    Parcel)                                        │
│       │           │                                           │
│  communication    devtools         monitor                    │
│  (event bus,      (import map      (perf tracking)            │
│   global state)    overrides)                                 │
└──────────────────────────────────────────────────────────────┘

Build & Server
┌──────────────────────────────────────────────────────────────┐
│  cli            vite-plugin     server          compat       │
│  (generate,     (manifest,      (deploy API,    (MF →        │
│   deploy)        externals)      storage)        import map) │
│                       │                                       │
│  config (schema, loading, validation)                         │
└──────────────────────────────────────────────────────────────┘

Foundation
┌──────────────────────────────────────────────────────────────┐
│  shared (types, errors, import map utilities)                 │
│  test (mock apps, test registry, matchers)                    │
└──────────────────────────────────────────────────────────────┘
```

**Dependency direction:** Application → `react` → `runtime` → `shared`.
Packages like `sandbox`, `guard`, `communication`, `monitor` have **zero cross-dependencies** — use only what you need.

## Examples

```bash
# Basic: import map generation pipeline
cd examples/basic && pnpm demo

# Multi-MFE: browser routing + dynamic loading + full integration
cd examples/multi-mfe && pnpm dev
```

## Development

```bash
git clone https://github.com/retemper/esmap.git
cd esmap
pnpm install

pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm type-check     # TypeScript validation
pnpm lint           # Lint
pnpm format         # Format with Prettier

# Single package
pnpm turbo test --filter=@esmap/runtime
```

## Contributing

We welcome contributions! Please see:

- [**CONTRIBUTING.md**](./CONTRIBUTING.md) — Setup, development workflow, PR guidelines
- [**Code of Conduct**](./CODE_OF_CONDUCT.md) — Community standards
- [**Security Policy**](./SECURITY.md) — Reporting vulnerabilities

## License

[MIT](./LICENSE)
