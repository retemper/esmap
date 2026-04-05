# Getting Started

## Installation

Install the packages you need:

```bash
pnpm add @esmap/runtime @esmap/react
pnpm add -D @esmap/vite-plugin @esmap/cli
```

## Quick Start

### 1. Write a micro-frontend

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
esmap serve --port 3000

esmap deploy --server http://localhost:3000 \
  --name @myorg/checkout \
  --url https://cdn.example.com/checkout-v2.js

# Rollback if needed
esmap rollback --server http://localhost:3000 --name @myorg/checkout
```

## Next steps

- [Import Maps](/guide/import-maps) — Understand the core standard esmap builds on
- [App Lifecycle](/guide/app-lifecycle) — bootstrap, mount, unmount, and update
- [Routing](/guide/routing) — How the router activates MFEs
- [React integration](/guide/react) — React-specific adapter and hooks
