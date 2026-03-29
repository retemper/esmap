# @esmap/sandbox

JavaScript sandbox implementations for MFE isolation.

Prevents MFEs from polluting the `window` global object. Zero external dependencies.

## Installation

```bash
pnpm add @esmap/sandbox
```

## Proxy Sandbox

Uses ES `Proxy` to create a virtual `window` per MFE. The real `window` is never modified.

```ts
import { ProxySandbox } from '@esmap/sandbox';

const sandbox = new ProxySandbox({
  name: 'checkout',
  // Global properties that bypass the sandbox (default: DEFAULT_ALLOW_LIST)
  allowList: ['fetch', 'console', 'setTimeout'],
});

// Activate — window access is now proxied through the sandbox
sandbox.activate();

// MFE code runs in isolation
sandbox.proxy.myGlobal = 'scoped'; // real window.myGlobal is unchanged

// Deactivate — restore original window
sandbox.deactivate();

// Inspect
sandbox.isActive(); // boolean
sandbox.getModifiedProps(); // property keys set within the sandbox
```

### DEFAULT_ALLOW_LIST

These globals bypass the sandbox by default:

```ts
import { DEFAULT_ALLOW_LIST } from '@esmap/sandbox';
// console, fetch, setTimeout, setInterval, clearTimeout, clearInterval,
// requestAnimationFrame, cancelAnimationFrame, ...
```

## Snapshot Sandbox

Snapshot-based isolation for environments without Proxy support:

```ts
import { createSnapshotSandbox } from '@esmap/sandbox';

const sandbox = createSnapshotSandbox('checkout');

// Activate — snapshots the current window state
sandbox.activate();

// MFE modifies window
window.myGlobal = 'polluted';

// Deactivate — restores window from snapshot
sandbox.deactivate();
// window.myGlobal is undefined again
```

> Snapshot Sandbox iterates all window properties on activate/deactivate, so it is slower than Proxy Sandbox. Prefer Proxy Sandbox when possible.

## Usage Pattern

```ts
import { ProxySandbox } from '@esmap/sandbox';

const sandboxes = new Map<string, ProxySandbox>();

registry.onStatusChange(({ appName, to }) => {
  if (to === 'MOUNTED') {
    const sandbox = new ProxySandbox({ name: appName });
    sandbox.activate();
    sandboxes.set(appName, sandbox);
  }
  if (to === 'NOT_MOUNTED') {
    sandboxes.get(appName)?.deactivate();
    sandboxes.delete(appName);
  }
});
```
