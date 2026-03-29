# @esmap/vite-plugin

Vite plugin — MFE manifest generation and ESM externals configuration.

## Installation

```bash
pnpm add -D @esmap/vite-plugin
```

**Peer dependency:** `vite ^5.0.0 || ^6.0.0`

## esmapManifest

Generates an MFE manifest at build time. The server collects these manifests to compose the import map:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { esmapManifest } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({
      name: '@myorg/checkout', // module name in the import map
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
    },
  },
});
```

Produces an `esmap-manifest.json` in the build output:

```json
{
  "name": "@myorg/checkout",
  "entry": "https://cdn.example.com/checkout/index.js",
  "dependencies": {}
}
```

### Options

```ts
esmapManifest({
  name: '@myorg/checkout', // required: module name
  fileName: 'manifest.json', // optional: manifest filename (default: 'esmap-manifest.json')
});
```

## esmapSharedDeps

Marks shared dependencies as external. They are not bundled and instead resolved via the import map at runtime:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { esmapManifest, esmapSharedDeps } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({ name: '@myorg/checkout' }),
    esmapSharedDeps({
      react: '^18.0.0',
      'react-dom': '^18.0.0',
      'react-router-dom': '^6.0.0',
    }),
  ],
});
```

This plugin:

1. Configures the specified dependencies as Rollup externals
2. Adds shared dependency metadata to the manifest
3. Preserves bare imports so they resolve through the import map at runtime

### Options

```ts
esmapSharedDeps({
  // package name: compatible range
  react: '^18.0.0',
  'react-dom': '^18.0.0',
});
```
