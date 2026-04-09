# @esmap/sandbox

JavaScript sandbox for micro-frontend isolation. Supports proxy-based sandboxing for modern browsers and snapshot sandboxing as a fallback, preventing global scope pollution between applications. (1.9 kB gzip)

## Installation

```bash
pnpm add @esmap/sandbox
```

## Classes

### `ProxySandbox`

```ts
class ProxySandbox {
  readonly name: string
  readonly proxy: Window
  constructor(options: ProxySandboxOptions)
  activate(): void
  deactivate(): void
  isActive(): boolean
}
```

Sandbox that uses `Proxy` to isolate window property modifications. Maintains a private map of modified properties without polluting the real `window`. Properties in the allow list are read directly from the real `window`.

## Constants

### `DEFAULT_ALLOW_LIST`

```ts
const DEFAULT_ALLOW_LIST: readonly PropertyKey[]
```

Default list of `window` properties that are read directly from the real window (e.g. `document`, `location`, `history`, `navigator`, `console`, `fetch`, `performance`).

## Functions

### `createSnapshotSandbox`

```ts
function createSnapshotSandbox(name: string): SnapshotSandbox
```

Creates a snapshot-based sandbox. On activate, captures a snapshot of all `window` own properties. On deactivate, detects changes, reverts them, and stores the diff for re-application.

### `createDomIsolation`

```ts
function createDomIsolation(options: DomIsolationOptions): DomIsolationHandle
```

Scopes `document.querySelector`, `getElementById`, and other DOM query methods to the app container boundary. Queries matching `globalSelectors` search the entire document.

### `createScopedStorage`

```ts
function createScopedStorage(options: ScopedStorageOptions): ScopedStorage
```

Creates a namespaced Web Storage wrapper. All key access is automatically prefixed with `${scope}${separator}` to prevent key collisions between MFE apps.

## Types

### `ProxySandboxOptions`

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | Identifying name for the sandbox instance |
| `allowList` | `PropertyKey[]` | Properties to read directly from the real window |

### `SnapshotSandbox`

| Method | Signature | Description |
| --- | --- | --- |
| `name` | `string` | Sandbox name |
| `activate` | `() => void` | Activates and reapplies previous changes |
| `deactivate` | `() => void` | Deactivates and reverts changes |
| `isActive` | `() => boolean` | Returns whether active |

### `DomIsolationOptions`

| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | App name (for debugging) |
| `container` | `HTMLElement` | App's DOM container element |
| `globalSelectors` | `string[]` | Selector patterns excluded from isolation |

### `DomIsolationHandle`

| Method | Signature | Description |
| --- | --- | --- |
| `dispose` | `() => void` | Releases isolation and restores original methods |
| `container` | `HTMLElement` | The isolated container element |

### `ScopedStorageOptions`

| Property | Type | Description |
| --- | --- | --- |
| `scope` | `string` | Scope name used as the key prefix |
| `storage` | `Storage` | Target storage (default: `localStorage`) |
| `separator` | `string` | Key separator (default: `":"`) |

### `ScopedStorage`

| Method | Signature | Description |
| --- | --- | --- |
| `getItem` | `(key: string) => string \| null` | Reads a value using the scoped key |
| `setItem` | `(key: string, value: string) => void` | Stores a value using the scoped key |
| `removeItem` | `(key: string) => void` | Deletes a scoped key |
| `keys` | `() => readonly string[]` | Returns all keys in this scope |
| `clear` | `() => void` | Deletes all entries in this scope |
| `scope` | `string` | The namespace prefix |
