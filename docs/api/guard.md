---
description: 'API reference for @esmap/guard — CSS scoping and global pollution detection.'
---

# @esmap/guard

Runtime guardrails for micro-frontends. Provides CSS scoping to prevent style leakage between applications and global pollution detection to catch unintended side effects. (2.7 kB gzip)

## Installation

```bash
pnpm add @esmap/guard
```

## Functions

### `applyCssScope`

```ts
function applyCssScope(container: HTMLElement, options: CssScopeOptions): HTMLElement;
```

Applies scope to a container. Creates a shadow root in Shadow DOM mode, otherwise adds a `data-esmap-scope` attribute. Returns the actual root element where the app should render.

### `removeCssScope`

```ts
function removeCssScope(container: HTMLElement, options: CssScopeOptions): void;
```

Removes scope from a container.

### `scopeCssText`

```ts
function scopeCssText(css: string, prefix: string): string;
```

Rewrites CSS selectors to add a scope prefix (e.g. `[data-esmap-scope="checkout"]`). Handles nested `@media`, `@supports`, `@layer`, and `@container` rules recursively. Skips `@keyframes`, `@font-face`, and already-prescoped CSS.

### `namespaceCssKeyframes`

```ts
function namespaceCssKeyframes(css: string, prefix: string): string;
```

Adds app name prefix to `@keyframes` names and their `animation`/`animation-name` references to prevent cross-app collisions.

### `isPrescopedCss`

```ts
function isPrescopedCss(css: string): boolean;
```

Checks whether the CSS contains a prescoping marker (build-time scoped).

### `createGlobalGuard`

```ts
function createGlobalGuard(options?: GlobalGuardOptions): GlobalGuardHandle;
```

Takes a snapshot of current `window` globals and periodically detects newly added properties. Reports violations via callback.

### `snapshotGlobals`

```ts
function snapshotGlobals(): Set<string>;
```

Captures a snapshot of all current `window` global keys.

### `diffGlobals`

```ts
function diffGlobals(snapshot: Set<string>): string[];
```

Returns keys that have been added to `window` since the snapshot.

### `createStyleIsolation`

```ts
function createStyleIsolation(options: StyleIsolationOptions): StyleIsolationHandle;
```

Automatically discovers and scopes styles inside the container when an MFE app is mounted. Optionally detects dynamically added styles via `MutationObserver`.

### `createStyleCollector`

```ts
function createStyleCollector(): StyleCollector;
```

Creates a per-app stylesheet tracking utility. Collects and manages style elements added to `document.head` on a per-app basis via `MutationObserver`.

### `createScopedStyleCollector`

```ts
function createScopedStyleCollector(
  options: ScopedStyleCollectorOptions,
): ScopedStyleCollectorHandle;
```

Creates a collector that detects `<style>` elements injected into `document.head` by CSS-in-JS libraries and automatically applies CSS scoping.

## Constants

### `PRESCOPED_MARKER`

```ts
const PRESCOPED_MARKER: string;
```

Marker string (`"/* @esmap:scoped"`) indicating that CSS was already scoped at build time.

## Types

### `CssScopeOptions`

| Property       | Type      | Description                                  |
| -------------- | --------- | -------------------------------------------- |
| `prefix`       | `string`  | Scope prefix (e.g. `"mfe-checkout"`)         |
| `useShadowDom` | `boolean` | Whether to use Shadow DOM (default: `false`) |

### `GlobalGuardOptions`

| Property      | Type                                   | Description                              |
| ------------- | -------------------------------------- | ---------------------------------------- |
| `allowList`   | `string[]`                             | Allowed global variable names            |
| `onViolation` | `(violation: GlobalViolation) => void` | Violation callback                       |
| `interval`    | `number`                               | Polling interval in ms (default: `1000`) |

### `GlobalGuardHandle`

| Method    | Signature                 | Description                               |
| --------- | ------------------------- | ----------------------------------------- |
| `dispose` | `() => readonly string[]` | Stops the guard and returns added globals |
| `check`   | `() => void`              | Manually triggers an immediate check      |

### `GlobalViolation`

| Property   | Type                | Description                                |
| ---------- | ------------------- | ------------------------------------------ |
| `property` | `string`            | Name of the added/modified global variable |
| `type`     | `'add' \| 'modify'` | Violation type                             |

### `StyleIsolationOptions`

| Property         | Type                      | Description                                          |
| ---------------- | ------------------------- | ---------------------------------------------------- |
| `appName`        | `string`                  | App name used for scoping                            |
| `container`      | `HTMLElement`             | Container element where the app is rendered          |
| `strategy`       | `'attribute' \| 'shadow'` | Scoping strategy (default: `'attribute'`)            |
| `observeDynamic` | `boolean`                 | Detect dynamically added styles via MutationObserver |

### `StyleIsolationHandle`

| Method           | Signature      | Description                          |
| ---------------- | -------------- | ------------------------------------ |
| `destroy`        | `() => void`   | Stops observer and removes scoping   |
| `getScopedCount` | `() => number` | Returns number of scoped stylesheets |
| `refresh`        | `() => void`   | Re-scopes all discovered styles      |

### `StyleCollector`

| Method         | Signature                                                      | Description                                     |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `startCapture` | `(appName: string) => void`                                    | Starts style collection for an app              |
| `stopCapture`  | `(appName: string) => (HTMLStyleElement \| HTMLLinkElement)[]` | Stops collection and returns collected elements |
| `removeStyles` | `(appName: string) => void`                                    | Removes all styles for an app from DOM          |
| `getStyles`    | `(appName: string) => (HTMLStyleElement \| HTMLLinkElement)[]` | Returns all styles for an app                   |
| `destroy`      | `() => void`                                                   | Releases the collector                          |

### `ScopedStyleCollectorOptions`

| Property  | Type                                                        | Description                                |
| --------- | ----------------------------------------------------------- | ------------------------------------------ |
| `appName` | `string`                                                    | App name used for scoping                  |
| `exclude` | `(element: HTMLStyleElement \| HTMLLinkElement) => boolean` | Predicate to exclude elements from scoping |
