---
description: 'API reference for @esmap/communication — type-safe event bus, global state, and app props.'
---

# @esmap/communication

Type-safe inter-application communication layer. Includes an event bus for decoupled messaging, global shared state management, and application props passing. (1.1 kB gzip)

## Installation

```bash
pnpm add @esmap/communication
```

## Functions

### `createEventBus`

```ts
function createEventBus<E extends EventMap = EventMap>(options?: EventBusOptions): EventBus<E>;
```

Creates a type-safe event bus. When an event map generic is provided, payload types are enforced for `emit`, `on`, and `once`. Supports wildcard subscriptions, event history replay, and request-response patterns.

### `createScopedEventBus`

```ts
function createScopedEventBus<E extends EventMap = EventMap>(
  bus: EventBus,
  scope: string,
): ScopedEventBus<E>;
```

Wraps an existing `EventBus` to create a namespace-isolated scoped bus. All events are automatically prefixed with the scope (e.g. `"checkout:loaded"`). Prevents event collisions between MFE apps.

### `createGlobalState`

```ts
function createGlobalState<T extends Record<string, unknown>>(initial: T): GlobalState<T>;
```

Creates a global state that can be shared between apps. Supports shallow merge updates, key-level selectors, and reset to initial state.

### `createAppProps`

```ts
function createAppProps<T extends Record<string, unknown>>(initial: T): AppProps<T>;
```

Manages properties passed from the shell to remote apps. Supports partial updates and change subscriptions.

### `createScopedGlobalState`

```ts
function createScopedGlobalState<T extends Record<string, unknown>, K extends keyof T>(
  options: ScopedGlobalStateOptions<T, K>,
): ScopedGlobalState<T, K>;
```

Creates a scoped view that can only access specific keys of the global state. Restricts per-MFE access to prevent unintended state mutations. Supports read-only mode.

### `createReadyGate`

```ts
function createReadyGate(options?: ReadyGateOptions): ReadyGate;
```

Creates a shared resource readiness synchronization gate. Prevents dependent apps from mounting before required shared state (e.g. auth tokens, user info) is ready.

## Types

### `EventBus`

| Method          | Signature                                                                           | Description                                         |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| `emit`          | `(event: K, payload?: E[K]) => void`                                                | Emits an event to all listeners                     |
| `on`            | `(event: K, handler: EventHandler<E[K]>, options?: SubscribeOptions) => () => void` | Subscribes to an event. Supports history replay.    |
| `once`          | `(event: K, handler: EventHandler<E[K]>) => () => void`                             | Subscribes to an event only once                    |
| `onAny`         | `(pattern: string, handler: EventHandler) => () => void`                            | Subscribes with a wildcard pattern (e.g. `"app:*"`) |
| `off`           | `(event: K) => void`                                                                | Removes all listeners for an event                  |
| `getHistory`    | `(event?: string) => EventRecord[]`                                                 | Retrieves event history                             |
| `request`       | `(event: K, payload?: E[K], timeout?: number) => Promise<unknown>`                  | Request-response pattern                            |
| `listenerCount` | `(event: string) => number`                                                         | Returns the number of listeners                     |

### `EventBusOptions`

| Property                | Type                                      | Description                                      |
| ----------------------- | ----------------------------------------- | ------------------------------------------------ |
| `maxHistory`            | `number`                                  | Max event history entries (default: `100`)       |
| `onHandlerError`        | `(event: string, error: unknown) => void` | Handler error callback                           |
| `defaultRequestTimeout` | `number`                                  | Request-response timeout in ms (default: `5000`) |

### `EventHandler`

```ts
type EventHandler<T = unknown> = (payload: T) => void;
```

### `EventMap`

```ts
type EventMap = Record<string, unknown>;
```

### `GlobalState`

| Method      | Signature                                                         | Description                             |
| ----------- | ----------------------------------------------------------------- | --------------------------------------- |
| `getState`  | `() => Readonly<T>`                                               | Returns a frozen copy of current state  |
| `setState`  | `(partial: Partial<T>) => void`                                   | Shallow merges and notifies subscribers |
| `subscribe` | `(listener: StateListener<T>) => () => void`                      | Subscribes to state changes             |
| `reset`     | `() => void`                                                      | Restores to initial state               |
| `select`    | `(key: K, listener: (newValue, prevValue) => void) => () => void` | Subscribes to a single key              |

### `StateListener`

```ts
type StateListener<T> = (newState: T, prevState: T) => void;
```

### `AppProps`

| Method          | Signature                                    | Description                            |
| --------------- | -------------------------------------------- | -------------------------------------- |
| `getProps`      | `() => Readonly<T>`                          | Returns a frozen copy of current props |
| `setProps`      | `(partial: Partial<T>) => void`              | Merges and notifies subscribers        |
| `onPropsChange` | `(listener: PropsListener<T>) => () => void` | Subscribes to prop changes             |

### `ScopedEventBus`

Same API surface as `EventBus`, but all events are automatically prefixed with the scope namespace.

### `ScopedGlobalState`

| Method        | Signature                                             | Description                                    |
| ------------- | ----------------------------------------------------- | ---------------------------------------------- |
| `getState`    | `() => Readonly<Pick<T, K>>`                          | Returns allowed keys only                      |
| `setState`    | `(partial: Partial<Pick<T, K>>) => void`              | Updates allowed keys. Throws in readonly mode. |
| `subscribe`   | `(listener: StateListener<Pick<T, K>>) => () => void` | Notified only when allowed keys change         |
| `allowedKeys` | `readonly K[]`                                        | List of accessible keys                        |

### `ReadyGate`

| Method        | Signature                            | Description                        |
| ------------- | ------------------------------------ | ---------------------------------- |
| `register`    | `(name: string) => void`             | Registers a resource to wait for   |
| `markReady`   | `(name: string) => void`             | Declares a resource ready          |
| `waitFor`     | `(name: string) => Promise<void>`    | Waits for a specific resource      |
| `waitForAll`  | `() => Promise<void>`                | Waits for all registered resources |
| `waitForMany` | `(names: string[]) => Promise<void>` | Waits for the specified resources  |
| `getStatus`   | `() => ResourceStatus[]`             | Returns status of all resources    |
| `isAllReady`  | `() => boolean`                      | Checks if all resources are ready  |
| `reset`       | `() => void`                         | Clears all registrations           |

### `ReadyGateOptions`

| Property  | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `timeout` | `number` | Max wait time in ms (default: `10000`) |
