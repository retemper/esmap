---
description: 'Isolate JavaScript globals between micro-frontends using proxy and snapshot sandboxes.'
---

# JS Sandbox

`@esmap/sandbox` provides JavaScript isolation between micro-frontends.

## Proxy Sandbox

Intercepts global variable access using `Proxy`, giving each MFE its own isolated `window`-like environment.

```ts
import { ProxySandbox } from '@esmap/sandbox';

const sandbox = new ProxySandbox({ name: 'my-app' });
sandbox.activate();

// Use sandbox.proxy as the isolated window
const scopedWindow = sandbox.proxy;
scopedWindow.myGlobal = 'scoped to this MFE';

sandbox.deactivate();
// window.myGlobal is undefined in the outer scope
```

### Options

| Option      | Type            | Description                                                                                                                  |
| ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `name`      | `string`        | Identifying name for the sandbox instance                                                                                    |
| `allowList` | `PropertyKey[]` | Properties to read directly from the real `window` (defaults: `document`, `location`, `navigator`, `console`, `fetch`, etc.) |

### Instance Methods

| Method               | Returns         | Description                                      |
| -------------------- | --------------- | ------------------------------------------------ |
| `activate()`         | `void`          | Activates the sandbox                            |
| `deactivate()`       | `void`          | Deactivates the sandbox                          |
| `isActive()`         | `boolean`       | Returns whether the sandbox is active            |
| `getModifiedProps()` | `PropertyKey[]` | Returns a list of property names modified so far |

### `proxy`

The `proxy` property exposes an isolated `Window`-like object. When the sandbox is active, writes go to the internal map instead of the real `window`.

```ts
sandbox.activate();

sandbox.proxy.MY_CONFIG = { debug: true };
console.log(window.MY_CONFIG); // undefined — real window is untouched

sandbox.deactivate();
```

## Snapshot Sandbox

Takes a snapshot of `window` before mount and restores it on unmount. Simpler but slower — useful as a fallback for environments without `Proxy` support.

```ts
import { createSnapshotSandbox } from '@esmap/sandbox';

const sandbox = createSnapshotSandbox('legacy-app');
sandbox.activate();

// Changes go directly to window, but are tracked
window.legacyFlag = true;

sandbox.deactivate();
// window.legacyFlag is reverted
```

## DOM Isolation

Scopes `document.querySelector`, `getElementById`, etc. to the app's container boundary, preventing MFEs from accessing each other's DOM.

```ts
import { createDomIsolation } from '@esmap/sandbox';

const isolation = createDomIsolation({
  name: 'my-app',
  container: document.getElementById('my-app-root')!,
  globalSelectors: ['#global-modal'], // bypass isolation for these
});

// document.querySelector('.btn') now searches only within #my-app-root
isolation.dispose(); // restores original document methods
```

## Scoped Storage

Namespaced `localStorage`/`sessionStorage` wrapper that prevents key collisions between MFEs.

```ts
import { createScopedStorage } from '@esmap/sandbox';

const storage = createScopedStorage({ scope: 'checkout' });
storage.setItem('cart', '[]'); // actual key: "checkout:cart"
storage.getItem('cart'); // reads "checkout:cart"
storage.keys(); // all keys in "checkout:" scope
storage.clear(); // removes only "checkout:*" keys
```
