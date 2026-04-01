# @esmap/ssr

Server-side rendering support for esmap micro-frontends. Resolves import map specifiers on Node.js and renders MFE apps to HTML for SSR/SSG workflows.

## Key Features

- **Server-side import map resolution** — same import map used in the browser works on the server
- **ESM module loader** — fetches and evaluates remote ESM modules on Node.js
- **React SSR** — `renderReactToString` and `createReactSsrRender` for React apps
- **HTML composition** — assembles full HTML documents with import map, preload hints, and hydration scripts
- **Client hydration** — `createReactHydrationApp` for seamless server-to-client transition

## Install

```bash
pnpm add @esmap/ssr
```

## Quick Start

### 1. Add `ssrRender` to your MFE entry

```ts
// apps/checkout/src/entry.ts
import { createReactMfeApp } from '@esmap/react';
import { createReactSsrRender } from '@esmap/ssr';
import App from './App';

// Client lifecycle (existing)
export const { bootstrap, mount, unmount } = createReactMfeApp({ rootComponent: App });

// SSR support (new)
export const ssrRender = createReactSsrRender({ rootComponent: App });
```

### 2. Render on the server

```ts
import { createSsrRenderer, composeHtml } from '@esmap/ssr';

const importMap = await fetch('http://localhost:3000/').then((r) => r.json());

const renderer = createSsrRenderer({
  importMap,
  externals: { react: 'react', 'react-dom': 'react-dom' },
});

const result = await renderer.renderApp('@myorg/checkout', {
  props: { userId: '123' },
});

const html = composeHtml({
  importMap: result.importMap,
  appHtml: result.html,
  preloadUrls: result.preloadUrls,
  hydrationScript: `import('@myorg/checkout').then(m => m.mount(document.getElementById('root')))`,
});
```

### 3. Hydrate on the client

```ts
// Use createReactHydrationApp instead of createReactMfeApp
import { createReactHydrationApp } from '@esmap/ssr/hydration';
import App from './App';

export const { bootstrap, mount, unmount } = createReactHydrationApp({ rootComponent: App });
```

## API Reference

### `createImportMapResolver(importMap)`

Creates a server-side resolver that maps bare specifiers to URLs using the W3C import map algorithm. Supports scoped resolution.

### `createServerModuleLoader(options)`

Creates a module loader that fetches remote ESM modules and evaluates them on Node.js. Supports caching, externals (local node_modules), and prefetching.

### `createSsrRenderer(options)`

High-level renderer that combines resolver + loader to load and render MFE apps. Expects modules to export `ssrRender(props?)`.

### `renderReactToString(options)` / `createReactSsrRender(options)`

React-specific SSR helpers. `createReactSsrRender` produces an `ssrRender` function compatible with the renderer.

### `composeHtml(options)`

Composes a complete HTML document with import map script tag, modulepreload hints, rendered markup, and hydration script.

### `createReactHydrationApp(options)` (from `@esmap/ssr/hydration`)

Creates an MFE app that uses `hydrateRoot` on first mount (when server-rendered HTML is present), then `createRoot` on subsequent mounts.
