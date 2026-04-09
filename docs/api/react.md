---
description: 'API reference for @esmap/react — createReactMfeApp, React hooks, and EsmapParcel component.'
---

# @esmap/react

React adapter for esmap. Provides `createReactMfeApp()` to register React micro-frontends, lifecycle hooks, and the `EsmapParcel` component for embedding child applications. (1.5 kB gzip)

## Installation

```bash
pnpm add @esmap/react
```

## Functions

### `createReactMfeApp`

```ts
function createReactMfeApp<P extends Record<string, unknown>>(
  options: ReactMfeAppOptions<P>,
): MfeApp;
```

Converts a React component into an esmap MfeApp lifecycle. Manages `createRoot`/`unmount` automatically to prevent memory leaks. Uses `flushSync` to guarantee DOM readiness when `mount()` returns.

### `useParcel`

```ts
function useParcel(
  appOrLoader: MfeApp | (() => Promise<MfeApp>),
  props?: Record<string, unknown>,
): {
  ref: React.RefObject<HTMLDivElement | null>;
  status: MfeAppStatus;
  error: Error | null;
};
```

Hook for imperatively mounting an esmap Parcel. Attach the returned `ref` to a DOM element to automatically mount and clean up on unmount.

### `useGlobalState`

```ts
function useGlobalState<T extends Record<string, unknown>>(store: GlobalState<T>): Readonly<T>;

function useGlobalState<T extends Record<string, unknown>, S>(
  store: GlobalState<T>,
  selector: (state: Readonly<T>) => S,
): S;
```

Subscribes to esmap `GlobalState` as React state. Uses `useSyncExternalStore` for concurrent mode safety. When a selector is provided, only re-renders when the selected value changes.

### `useAppStatus`

```ts
function useAppStatus(registry: AppRegistry, appName: string): MfeAppStatus;
```

Subscribes to app status changes from the esmap `AppRegistry`. Re-renders only when the specified app's status changes.

## Components

### `EsmapParcel`

```ts
function EsmapParcel(props: EsmapParcelProps): ReactNode;
```

Declaratively mounts an esmap Parcel within a React component tree. Internally uses `useParcel` and automatically cleans up on unmount.

## Types

### `ReactMfeAppOptions`

| Property        | Type                                     | Description                       |
| --------------- | ---------------------------------------- | --------------------------------- |
| `rootComponent` | `ComponentType<P>`                       | React component to mount          |
| `wrapWith`      | `ComponentType<{ children: ReactNode }>` | Wrapper component (e.g. Provider) |
| `errorBoundary` | `ComponentType<{ error: Error }>`        | Error boundary fallback UI        |

### `EsmapParcelProps`

| Property         | Type                              | Description                      |
| ---------------- | --------------------------------- | -------------------------------- |
| `app`            | `MfeApp \| () => Promise<MfeApp>` | App or async loader to mount     |
| `appProps`       | `Record<string, unknown>`         | Props to pass to the app         |
| `loading`        | `ReactNode`                       | Loading UI shown while mounting  |
| `errorFallback`  | `(error: Error) => ReactNode`     | Error UI shown on failure        |
| `className`      | `string`                          | Class name for the container div |
| `onStatusChange` | `(status: MfeAppStatus) => void`  | Status change callback           |
