# @esmap/react

React adapter — MFE lifecycle wrapper, hooks, and Parcel component.

Use this to turn React apps into esmap MFEs, or embed other MFEs as React components.

## Installation

```bash
pnpm add @esmap/react
```

**Peer dependencies:** `react >= 18.0.0`, `react-dom >= 18.0.0`

## createReactMfeApp

Wraps a React component into esmap MFE lifecycle functions (`bootstrap`, `mount`, `unmount`):

```tsx
// apps/dashboard/src/index.tsx
import { createReactMfeApp } from '@esmap/react';
import { App } from './App';

const { bootstrap, mount, unmount } = createReactMfeApp({
  rootComponent: App,
  // Optional: fallback on error
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
});

export { bootstrap, mount, unmount };
```

On `mount`, a React root is created in the `container` and `App` is rendered.
On `unmount`, the React root is cleaned up. Uses `flushSync` to guarantee synchronous rendering.

## EsmapParcel

Inline-mount another MFE as a React component:

```tsx
import { EsmapParcel } from '@esmap/react';

function CheckoutPage() {
  return (
    <div>
      <h1>Payment</h1>
      <EsmapParcel
        app={() => import('@myorg/payment-widget')}
        appProps={{ currency: 'KRW' }}
        loading={<div>Loading...</div>}
        errorFallback={(error) => <div>Error: {error.message}</div>}
      />
    </div>
  );
}
```

The parcel loads on component mount and cleans up on unmount.

## Hooks

### useAppStatus

Subscribe to an MFE app's current lifecycle status:

```tsx
import { useAppStatus } from '@esmap/react';

function StatusBadge({ registry, appName }: { registry: AppRegistry; appName: string }) {
  const status = useAppStatus(registry, appName);
  // 'NOT_LOADED' | 'LOADING' | 'BOOTSTRAPPING' | 'NOT_MOUNTED' | 'MOUNTED' | ...
  return <span>{status}</span>;
}
```

Uses `useSyncExternalStore` for React concurrent mode safety.

### useGlobalState

Subscribe to `@esmap/communication`'s `GlobalState` in React:

```tsx
import { useGlobalState } from '@esmap/react';
import { sharedState } from './shared';

function UserInfo() {
  const state = useGlobalState(sharedState);
  return <span>{state.userName}</span>;
}
```

### useParcel

Programmatically control a parcel:

```tsx
import { useParcel } from '@esmap/react';

function Widget() {
  const { ref, status, error } = useParcel(() => import('@myorg/widget'), { mode: 'compact' });

  if (status === 'LOADING') return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div ref={ref} />;
}
```
