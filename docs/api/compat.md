---
description: 'API reference for @esmap/compat — migration layer from Webpack Module Federation to import maps.'
---

# @esmap/compat

Migration compatibility layer for esmap. Provides adapters and utilities to incrementally migrate existing Webpack Module Federation setups to native import maps without a full rewrite.

## Installation

```bash
pnpm add @esmap/compat
```

## Functions

### `convertMfToImportMap`

```ts
function convertMfToImportMap(
  remotes: readonly MfRemoteConfig[],
  options: MfToImportMapOptions,
): ImportMap;
```

Converts Module Federation remote configurations into import map format. Maps each remote app's scope as a bare specifier to its build artifact URL, including exposed submodule entries.

### `convertMfSharedToImports`

```ts
function convertMfSharedToImports(
  shared: Record<string, string>,
  cdnBase: string,
): Record<string, string>;
```

Generates import map entries for shared libraries from an MF shared dependency configuration (name-to-version mapping).

## Types

### `MfRemoteConfig`

| Property         | Type                | Description                          |
| ---------------- | ------------------- | ------------------------------------ |
| `name`           | `string`            | App name (e.g. `"flexCheckout"`)     |
| `scope`          | `string`            | Scope name (e.g. `"@flex/checkout"`) |
| `remoteEntryUrl` | `string`            | App entry point URL (remoteEntry.js) |
| `exposes`        | `MfExposedModule[]` | List of exposed modules              |

### `MfExposedModule`

| Property | Type     | Description                                      |
| -------- | -------- | ------------------------------------------------ |
| `key`    | `string` | Expose key (e.g. `"./Button"`)                   |
| `path`   | `string` | File path (e.g. `"./src/components/Button.tsx"`) |

### `MfToImportMapOptions`

| Property      | Type     | Description                                                  |
| ------------- | -------- | ------------------------------------------------------------ |
| `cdnBase`     | `string` | CDN base URL                                                 |
| `pathPattern` | `string` | Per-app artifact path pattern (default: `"{scope}/{entry}"`) |
