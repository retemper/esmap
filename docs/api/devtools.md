# @esmap/devtools

Developer tools for esmap. Enables import map overrides so individual micro-frontends can be pointed to a local development server without redeploying the host application. (1.0 kB gzip)

## Installation

```bash
pnpm add @esmap/devtools
```

## Functions

### `getOverrides`

```ts
function getOverrides(): readonly OverrideEntry[];
```

Reads the current override list from `localStorage`. Returns an empty array on parse failure.

### `setOverride`

```ts
function setOverride(specifier: string, url: string): void;
```

Adds or updates an override. Overwrites the URL if the same specifier already exists.

### `removeOverride`

```ts
function removeOverride(specifier: string): void;
```

Removes the override for a specific module specifier.

### `clearOverrides`

```ts
function clearOverrides(): void;
```

Removes all active overrides from `localStorage`.

### `applyOverrides`

```ts
function applyOverrides(importMap: ImportMap): ImportMap;
```

Merges active overrides into an import map, returning a new map with overridden URLs.

### `hasActiveOverrides`

```ts
function hasActiveOverrides(): boolean;
```

Returns whether any overrides are currently active.

### `installDevtoolsApi`

```ts
function installDevtoolsApi(): void;
```

Installs the devtools API singleton on `window.__ESMAP__` for browser console access.

### `createDevtoolsOverlay`

```ts
function createDevtoolsOverlay(options?: OverlayOptions): DevtoolsOverlay;
```

Creates a visual debug overlay that displays MFE app status, performance metrics, and active overrides. Toggled via keyboard shortcut.

### `createDevtoolsInspector`

```ts
function createDevtoolsInspector(): DevtoolsInspector;
```

Creates a runtime state inspector for examining event bus, shared module, and app registry state from the browser console.

## Types

### `OverrideEntry`

| Property    | Type     | Description                                                  |
| ----------- | -------- | ------------------------------------------------------------ |
| `specifier` | `string` | Original module specifier (e.g. `"@flex/checkout"`)          |
| `url`       | `string` | Replacement URL (e.g. `"http://localhost:5173/checkout.js"`) |

### `EsmapDevtoolsApi`

| Method           | Signature                                  | Description                        |
| ---------------- | ------------------------------------------ | ---------------------------------- |
| `overrides`      | `() => void`                               | Prints active overrides to console |
| `override`       | `(specifier: string, url: string) => void` | Overrides a module URL             |
| `removeOverride` | `(specifier: string) => void`              | Removes an override                |
| `clearOverrides` | `() => void`                               | Removes all overrides              |
| `isOverriding`   | `() => boolean`                            | Whether any overrides are active   |
| `inspect`        | `DevtoolsInspector`                        | Runtime state inspector            |

### `DevtoolsOverlay`

| Method    | Signature                          | Description                             |
| --------- | ---------------------------------- | --------------------------------------- |
| `show`    | `() => void`                       | Shows the overlay                       |
| `hide`    | `() => void`                       | Hides the overlay                       |
| `toggle`  | `() => void`                       | Toggles visibility                      |
| `update`  | `(apps: OverlayAppInfo[]) => void` | Updates displayed app info              |
| `destroy` | `() => void`                       | Removes the overlay and event listeners |
| `visible` | `boolean`                          | Whether currently visible               |

### `OverlayOptions`

| Property     | Type                                                           | Description                                            |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------ |
| `triggerKey` | `string`                                                       | Keyboard shortcut to toggle (default: `"Alt+Shift+D"`) |
| `position`   | `'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` | Initial position (default: `'bottom-right'`)           |

### `DevtoolsInspector`

Runtime state inspector accessible via `window.__ESMAP__.inspect`. Call `connect()` to wire up runtime objects, then query events, modules, and app state from the browser console.
