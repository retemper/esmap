# @esmap/vite-plugin

Vite plugin for esmap. Handles manifest generation for import map deployments, builds shared dependencies as individual ESM modules, and scopes CSS at build time.

## Installation

```bash
pnpm add -D @esmap/vite-plugin
```

## Functions

### `esmapManifest`

```ts
function esmapManifest(options: ManifestPluginOptions): Plugin;
```

Vite plugin that automatically generates an MFE manifest JSON after build. Analyzes build output file names (including content hashes) and sets shared dependencies as Vite externals.

### `esmapSharedDeps`

```ts
function esmapSharedDeps(options: SharedDepsPluginOptions): Plugin;
```

Vite plugin that builds shared dependencies as individual ESM modules with content-hash file names and generates a `SharedDependencyManifest`.

### `esmapCssScope`

```ts
function esmapCssScope(options: CssScopePluginOptions): Plugin;
```

Vite plugin that scopes CSS by app name at build time. Eliminates runtime scoping cost and prevents FOUC. Uses `scopeCssText` and `namespaceCssKeyframes` from `@esmap/guard` internally.

## Types

### `ManifestPluginOptions`

| Property         | Type       | Description                                              |
| ---------------- | ---------- | -------------------------------------------------------- |
| `name`           | `string`   | MFE app name (e.g. `"@flex/checkout"`)                   |
| `version`        | `string`   | App version. Reads from `package.json` if not specified. |
| `shared`         | `string[]` | Shared dependency list. Set as Vite externals.           |
| `internal`       | `string[]` | Internal package dependency list                         |
| `outputFileName` | `string`   | Manifest file name (default: `"esmap-manifest.json"`)    |

### `SharedDepsPluginOptions`

| Property         | Type                     | Description                                                              |
| ---------------- | ------------------------ | ------------------------------------------------------------------------ |
| `deps`           | `Record<string, string>` | Shared dependency entries. Key = package name, value = import specifier. |
| `outDir`         | `string`                 | Build output directory                                                   |
| `outputFileName` | `string`                 | Manifest file name (default: `"shared-deps-manifest.json"`)              |

### `CssScopePluginOptions`

| Property             | Type                   | Description                                       |
| -------------------- | ---------------------- | ------------------------------------------------- |
| `appName`            | `string`               | App name to use for scoping                       |
| `exclude`            | `(string \| RegExp)[]` | File patterns to exclude from scoping             |
| `namespaceKeyframes` | `boolean`              | Enable `@keyframes` namespacing (default: `true`) |
