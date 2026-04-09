---
description: 'API reference for @esmap/config — configuration schema, loading, and validation.'
---

# @esmap/config

Configuration utilities for esmap. Defines the configuration schema, handles loading from multiple sources, and validates settings at startup to catch misconfigurations early.

## Installation

```bash
pnpm add @esmap/config
```

## Functions

### `defineConfig`

```ts
function defineConfig(config: EsmapConfig): EsmapConfig;
```

Helper to create a type-safe configuration object. Used in `esmap.config.ts` files.

### `resolveConfig`

```ts
function resolveConfig(config: EsmapConfig): ResolvedConfig;
```

Returns a fully resolved config by merging defaults into user-provided settings.

### `validateConfig`

```ts
function validateConfig(config: unknown): readonly ConfigFieldError[];
```

Validates a config object. Returns a list of field-level validation errors.

### `assertValidConfig`

```ts
function assertValidConfig(config: unknown): asserts config is EsmapConfig;
```

Validates a config object and throws a `ConfigValidationError` if invalid.

### `loadConfig`

```ts
function loadConfig(cwd?: string): Promise<EsmapConfig>;
```

Searches for and loads a config file from the project directory. Tries `esmap.config.ts`, `.js`, `.mjs`, and `.json` in order.

### `loadConfigFile`

```ts
function loadConfigFile(filePath: string): Promise<EsmapConfig>;
```

Loads a config file at the specified absolute path. Supports `.ts`, `.js`, `.mjs`, and `.json` extensions.

## Types

### `ResolvedConfig`

| Property   | Type                       | Description                                     |
| ---------- | -------------------------- | ----------------------------------------------- |
| `apps`     | `EsmapConfig['apps']`      | App configuration map                           |
| `shared`   | `EsmapConfig['shared']`    | Shared dependency configuration                 |
| `cdnBase`  | `string`                   | CDN base URL (default: `""`)                    |
| `server`   | `Required<ServerConfig>`   | Server configuration with all defaults filled   |
| `devtools` | `Required<DevtoolsConfig>` | Devtools configuration with all defaults filled |

### `ConfigFieldError`

| Property  | Type     | Description                                        |
| --------- | -------- | -------------------------------------------------- |
| `path`    | `string` | Config field path (e.g. `"apps"`, `"server.port"`) |
| `message` | `string` | Validation error message                           |
