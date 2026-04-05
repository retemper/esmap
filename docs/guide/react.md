# React

::: warning WIP
This page is under construction.
:::

`@esmap/react` provides a React adapter for esmap micro-frontends.

## Creating a React MFE

```tsx
import { createReactMfeApp } from '@esmap/react';
import { App } from './App';

export const { bootstrap, mount, unmount } = createReactMfeApp({
  rootComponent: App,
});
```

## Parcel component

Embed another MFE inside a React component:

```tsx
import { EsmapParcel } from '@esmap/react';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <EsmapParcel name="@myorg/chart-widget" />
    </div>
  );
}
```
