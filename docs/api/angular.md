---
description: 'API reference for @esmap/angular — Angular adapter for esmap micro-frontends.'
---

# @esmap/angular

Angular adapter for esmap. Provides utilities to register and mount Angular micro-frontend applications within the esmap runtime. Requires Angular 17+ standalone component API.

## Installation

```bash
pnpm add @esmap/angular
```

## Functions

### `createAngularMfeApp`

```ts
function createAngularMfeApp(options: AngularMfeAppOptions): MfeApp;
```

Converts an Angular standalone component into an esmap MfeApp lifecycle. Props are delivered via the `ESMAP_PROPS` injection token as a read-only Signal.

## Constants

### `ESMAP_PROPS`

```ts
const ESMAP_PROPS: InjectionToken<Signal<Readonly<Record<string, unknown>>>>;
```

Injection token for esmap props passed from the shell application. Angular components inject this to receive cross-framework props as a Signal.

## Types

### `AngularMfeAppOptions`

| Property        | Type            | Description                                               |
| --------------- | --------------- | --------------------------------------------------------- |
| `rootComponent` | `Type<unknown>` | Root Angular standalone component to bootstrap            |
| `providers`     | `Provider[]`    | Additional providers to register at the application level |
