# @esmap/devtools

Developer tools — test local MFE builds against production using import map overrides.

Replace a specific MFE's URL in the production import map with your local dev server URL. All other apps stay on production.

## Installation

```bash
pnpm add @esmap/devtools
```

## Override Management

Overrides are stored in `localStorage` and persist across browser sessions:

```ts
import {
  getOverrides,
  setOverride,
  removeOverride,
  clearOverrides,
  hasActiveOverrides,
  applyOverrides,
} from '@esmap/devtools';

// Set an override
setOverride('@myorg/checkout', 'http://localhost:5173/src/index.ts');

// Query current overrides
const overrides = getOverrides();
// -> [{ specifier: '@myorg/checkout', url: 'http://localhost:5173/src/index.ts' }]

// Check if any overrides exist
hasActiveOverrides(); // true

// Apply overrides to an import map
const patchedMap = applyOverrides(originalImportMap);
// -> imports['@myorg/checkout'] is replaced with the local URL

// Remove a specific override
removeOverride('@myorg/checkout');

// Clear all
clearOverrides();
```

## Devtools API

Global API accessible from the browser console:

```ts
import { installDevtoolsApi } from '@esmap/devtools';

// Installs API at window.__ESMAP__
installDevtoolsApi();
```

After installation, use in the browser console:

```js
__ESMAP__.setOverride('@myorg/checkout', 'http://localhost:5173/src/index.ts');
__ESMAP__.getOverrides();
__ESMAP__.clearOverrides();
// Refresh -> checkout loads from local dev server, everything else from production
```

## Shell App Integration Example

```ts
import { loadImportMap } from '@esmap/runtime';
import { applyOverrides, installDevtoolsApi, hasActiveOverrides } from '@esmap/devtools';

// 1. Install devtools API
installDevtoolsApi();

// 2. Load import map
const importMap = await fetch('/importmap.json').then((r) => r.json());

// 3. Apply overrides
const effectiveMap = hasActiveOverrides() ? applyOverrides(importMap) : importMap;

// 4. Inject into browser
await loadImportMap({ inlineImportMap: effectiveMap });
```
