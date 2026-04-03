# What is esmap?

**esmap** is a micro-frontend framework built on [W3C Import Maps](https://wicg.github.io/import-maps/) — a browser-native standard for module resolution.

Most micro-frontend solutions couple you to a specific bundler or invent custom module protocols. esmap takes a different approach: your MFEs are just ESM modules that the browser resolves natively.

## How it compares

|                        | Module Federation | single-spa     | qiankun          | esmap              |
| ---------------------- | ----------------- | -------------- | ---------------- | ------------------ |
| **Standard**           | Webpack-specific  | Custom loader  | Wraps single-spa | W3C Import Maps    |
| **Bundler**            | Webpack only      | Any            | Any              | Any                |
| **Module format**      | Webpack chunks    | SystemJS / ESM | SystemJS         | Native ESM         |
| **JS isolation**       | None              | None           | Proxy sandbox    | Proxy + Snapshot   |
| **CSS isolation**      | None              | None           | Shadow DOM       | Scoped + detection |
| **Deploy server**      | None              | None           | None             | Built-in           |
| **Devtools**           | None              | Inspector      | None             | Built-in           |
| **Deploy coupling**    | Build-time        | Build-time     | Build-time       | Deploy-time        |

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

## Packages

### Browser

| Package               | Size (gzip) | Description                                                       |
| --------------------- | ----------- | ----------------------------------------------------------------- |
| `@esmap/runtime`      | 8.2 kB      | Import map loader, app registry, router, error boundary, prefetch |
| `@esmap/react`        | 1.5 kB      | React adapter — `createReactMfeApp()`, hooks, `<EsmapParcel>`     |
| `@esmap/communication`| 1.1 kB      | Type-safe event bus, global state, app props                      |
| `@esmap/sandbox`      | 1.9 kB      | Proxy sandbox, snapshot sandbox                                   |
| `@esmap/guard`        | 2.7 kB      | CSS scoping, global pollution detection                           |
| `@esmap/devtools`     | 1.0 kB      | Import map override for local development                         |
| `@esmap/monitor`      | 1.1 kB      | Performance tracking per lifecycle phase                          |

### Build & Server

| Package               | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `@esmap/cli`          | CLI — generate, deploy, rollback                           |
| `@esmap/vite-plugin`  | Vite plugin — manifest generation, ESM externals           |
| `@esmap/server`       | Import map server — deploy API, rollback, history          |
| `@esmap/config`       | Configuration schema, loading, validation                  |
| `@esmap/compat`       | Migration layer — Webpack Module Federation to import maps |
