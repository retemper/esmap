---
description: 'Use the esmap Vite plugin for manifest generation and ESM externals configuration.'
---

# Vite Plugin

`@esmap/vite-plugin` provides Vite integration for building micro-frontends. It exports three plugins:

- **`esmapManifest`** — generates MFE manifest JSON after build
- **`esmapSharedDeps`** — builds shared dependencies as individual ESM modules
- **`esmapCssScope`** — scopes CSS by app name at build time

## Installation

```bash
pnpm add -D @esmap/vite-plugin
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { esmapManifest, esmapSharedDeps, esmapCssScope } from '@esmap/vite-plugin';

export default defineConfig({
  plugins: [
    esmapManifest({ name: '@myorg/checkout' }),
    esmapSharedDeps({ deps: { react: 'react', 'react-dom': 'react-dom' } }),
    esmapCssScope({ appName: 'checkout' }),
  ],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'] },
  },
});
```

## `esmapManifest`

Generates a manifest JSON file during build that describes the MFE's entry point, assets, and dependencies.

### Options

| Option           | Type       | Default                 | Description                                         |
| ---------------- | ---------- | ----------------------- | --------------------------------------------------- |
| `name`           | `string`   | _(required)_            | MFE app name (e.g., `"@myorg/checkout"`)            |
| `version`        | `string`   | from `package.json`     | MFE app version                                     |
| `shared`         | `string[]` | `[]`                    | Shared dependency names. Also set as Vite externals |
| `internal`       | `string[]` | `[]`                    | Internal package dependencies                       |
| `outputFileName` | `string`   | `"esmap-manifest.json"` | Output file name                                    |

## `esmapSharedDeps`

Builds shared dependencies as individual ESM modules with content-hashed file names and generates a `shared-deps-manifest.json`.

### Options

| Option           | Type                     | Default                       | Description                                                      |
| ---------------- | ------------------------ | ----------------------------- | ---------------------------------------------------------------- |
| `deps`           | `Record<string, string>` | _(required)_                  | Dependency entries. Key = package name, value = import specifier |
| `outDir`         | `string`                 | `"dist"`                      | Build output directory                                           |
| `outputFileName` | `string`                 | `"shared-deps-manifest.json"` | Manifest output file name                                        |

## `esmapCssScope`

Scopes CSS by app name at build time. Adds `[data-esmap-scope="appName"]` prefix to selectors and optionally namespaces `@keyframes`. This eliminates runtime scoping cost and prevents FOUC.

CSS Modules files (`.module.css`) are automatically skipped since they already have local scoping.

### Options

| Option               | Type                   | Default      | Description                             |
| -------------------- | ---------------------- | ------------ | --------------------------------------- |
| `appName`            | `string`               | _(required)_ | App name used for CSS scoping           |
| `exclude`            | `(string \| RegExp)[]` | `[]`         | File patterns to exclude from scoping   |
| `namespaceKeyframes` | `boolean`              | `true`       | Whether to namespace `@keyframes` names |

### Example

```ts
esmapCssScope({
  appName: 'checkout',
  exclude: [/node_modules/, 'global.css'],
  namespaceKeyframes: true,
});
```
