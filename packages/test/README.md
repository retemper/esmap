# @esmap/test

Testing utilities for esmap MFE apps.

Provides mock apps, test registry, test harness, and matchers to simplify MFE lifecycle testing.

## Installation

```bash
pnpm add -D @esmap/test
```

## Mock App

Create mock MFE apps for testing:

```ts
import { createMockApp, createFailingApp } from '@esmap/test';

// Normal mock
const app = createMockApp({
  bootstrap: async () => {
    /* custom logic */
  },
});

// Access lifecycle spies
app.bootstrapSpy.calls; // SpyCall[]
app.bootstrapSpy.callCount; // number
app.mountSpy.calls;
app.unmountSpy.calls;

// Mock that fails at a specific lifecycle phase
const failingApp = createFailingApp('mount', new Error('DOM not ready'));
```

## Test Registry

Set up an AppRegistry for testing:

```ts
import { createTestRegistry } from '@esmap/test';

const { registry, apps } = createTestRegistry({
  apps: [
    {
      name: '@myorg/checkout',
      activeWhen: '/checkout',
      // Inline MFE definition
      module: {
        bootstrap: async () => {},
        mount: async (el) => {
          el.textContent = 'Checkout';
        },
        unmount: async (el) => {
          el.textContent = '';
        },
      },
    },
  ],
});

// registry is a real AppRegistry instance
await registry.loadApp('@myorg/checkout');
await registry.mountApp('@myorg/checkout');
```

## Test Harness

Integration-test the full MFE lifecycle:

```ts
import { createTestHarness } from '@esmap/test';

const harness = createTestHarness({
  importMap: {
    imports: { '@myorg/checkout': '/test-fixtures/checkout.js' },
    scopes: {},
  },
});

await harness.start();
// ... test ...
await harness.cleanup();
```

## Matchers

Helpers for asserting app state:

```ts
import { isAppMounted, isAppInStatus, getAppContainer, waitForAppStatus } from '@esmap/test';

// Check if mounted
expect(isAppMounted(registry, '@myorg/checkout')).toBe(true);

// Check specific status
expect(isAppInStatus(registry, '@myorg/checkout', 'NOT_MOUNTED')).toBe(true);

// Get app's DOM container
const container = getAppContainer(registry, '@myorg/checkout');

// Wait for a status asynchronously
await waitForAppStatus(registry, '@myorg/checkout', 'MOUNTED');
```
