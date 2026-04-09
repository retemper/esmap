# @esmap/vue

Vue adapter for esmap. Provides utilities to register and mount Vue micro-frontend applications within the esmap runtime.

## Installation

```bash
pnpm add @esmap/vue
```

## Functions

### `createVueMfeApp`

```ts
function createVueMfeApp(options: VueMfeAppOptions): MfeApp;
```

Converts a Vue 3 component into an esmap MfeApp lifecycle. Manages `createApp`/`unmount` automatically to prevent memory leaks. Props are delivered via a reactive `ref` so updates trigger Vue reactivity.

## Types

### `VueMfeAppOptions`

| Property        | Type        | Description                                                           |
| --------------- | ----------- | --------------------------------------------------------------------- |
| `rootComponent` | `Component` | Vue component to mount                                                |
| `wrapWith`      | `Component` | Wrapper component (e.g. plugin provider). Must render a default slot. |
