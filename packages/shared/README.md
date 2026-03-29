# @esmap/shared

Shared types, error classes, and import map utilities for the esmap framework.

The foundation package that all `@esmap/*` packages depend on.

## Installation

```bash
pnpm add @esmap/shared
```

## Types

### Import Map

```ts
import type { ImportMap, ImportMapEntry, ImportMapMergeStrategy } from '@esmap/shared';

const map: ImportMap = {
  imports: {
    '@myorg/checkout': 'https://cdn.example.com/checkout.js',
    react: 'https://cdn.example.com/react.js',
  },
  scopes: {},
};
```

### MFE Lifecycle

```ts
import type { MfeApp, MfeAppStatus, RegisteredApp } from '@esmap/shared';

// Interface that every MFE must implement
const app: MfeApp = {
  bootstrap: async () => {
    /* one-time init */
  },
  mount: async (container) => {
    /* render to DOM */
  },
  unmount: async (container) => {
    /* remove from DOM */
  },
};

// Status flow: NOT_LOADED -> LOADING -> BOOTSTRAPPING -> NOT_MOUNTED <-> MOUNTED
```

### Configuration

```ts
import type { EsmapConfig, AppConfig, SharedConfig, ServerConfig } from '@esmap/shared';
```

### Manifest

```ts
import type { MfeManifest, ManifestDependencies, SharedDependencyManifest } from '@esmap/shared';
```

## Import Map Utilities

```ts
import {
  createEmptyImportMap,
  mergeImportMaps,
  parseImportMap,
  serializeImportMap,
} from '@esmap/shared';

// Create an empty import map
const empty = createEmptyImportMap();

// Merge two import maps
const merged = mergeImportMaps(mapA, mapB, 'override'); // 'override' | 'skip' | 'error'

// JSON string -> ImportMap
const parsed = parseImportMap('{"imports":{"react":"https://cdn/react.js"}}');

// ImportMap -> JSON string (sorted)
const json = serializeImportMap(parsed);
```

## Manifest Utilities

```ts
import { parseManifest, validateManifest, resolveManifestUrls } from '@esmap/shared';

// JSON -> MfeManifest
const manifest = parseManifest(jsonString);

// Validate
const errors = validateManifest(manifest);

// Relative URLs -> absolute URLs
const resolved = resolveManifestUrls(manifest, 'https://cdn.example.com/');
```

## Error Classes

All errors extend `EsmapError`:

```ts
import {
  EsmapError, // base error
  ImportMapError, // import map parsing/processing
  ImportMapConflictError, // merge conflict
  ImportMapLoadError, // load failure
  ManifestValidationError,
  ConfigValidationError,
  AppLifecycleError, // bootstrap/mount/unmount error
  AppNotFoundError, // accessing unregistered app
  AppAlreadyRegisteredError,
  ContainerNotFoundError, // DOM selector not found
} from '@esmap/shared';
```

## Type Guard

```ts
import { isRecord } from '@esmap/shared';

isRecord({ a: 1 }); // true
isRecord(null); // false
isRecord('string'); // false
```
