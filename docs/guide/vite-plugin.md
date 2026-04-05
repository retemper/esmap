# Vite Plugin

::: warning WIP
This page is under construction.
:::

`@esmap/vite-plugin` provides Vite integration for building micro-frontends.

## Installation

```bash
pnpm add -D @esmap/vite-plugin
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { esmapManifest, esmapSharedDeps } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({ name: '@myorg/checkout' }),
    esmapSharedDeps({ react: '^18.0.0', 'react-dom': '^18.0.0' }),
  ],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'] },
  },
});
```

## `esmapManifest`

Generates a manifest JSON file during build that describes the MFE's entry point and assets.

## `esmapSharedDeps`

Externalizes shared dependencies (e.g., React) so they are loaded from the import map instead of bundled.
