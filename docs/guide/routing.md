# Routing

::: warning WIP
This page is under construction.
:::

esmap's router activates and deactivates MFEs based on the browser URL.

## Basic usage

```ts
import { AppRegistry, Router } from '@esmap/runtime';

const registry = new AppRegistry();

registry.registerApp({
  name: '@myorg/checkout',
  activeWhen: '/checkout',
  container: '#mfe-root',
});

const router = new Router(registry);
await router.start();
```

## Route matching

The `activeWhen` option supports:

- **String prefix** — `'/checkout'` matches `/checkout`, `/checkout/step-1`, etc.
- **Function** — `(url) => url.pathname.startsWith('/checkout')`
- **Array** — `['/checkout', '/cart']`

## Race-condition safety

Stale navigations are automatically discarded. If a user navigates to `/a` then quickly to `/b`, the mount of `/a` is cancelled so `/b` mounts cleanly.
