# JS Sandbox

::: warning WIP
This page is under construction.
:::

`@esmap/sandbox` provides JavaScript isolation between micro-frontends.

## Proxy Sandbox

Intercepts global variable access using `Proxy`, giving each MFE its own isolated `window`-like environment.

```ts
import { createProxySandbox } from '@esmap/sandbox';

const sandbox = createProxySandbox();
sandbox.activate();

// MFE code runs in an isolated global scope
sandbox.exec(() => {
  window.myGlobal = 'scoped to this MFE';
});

sandbox.deactivate();
// window.myGlobal is undefined in the outer scope
```

## Snapshot Sandbox

Takes a snapshot of `window` before mount and restores it on unmount. Simpler but slower — useful as a fallback for environments without `Proxy` support.
