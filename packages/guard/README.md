# @esmap/guard

CSS isolation and global pollution detection for micro-frontends.

Prevents MFE styles from leaking into other apps and detects unexpected global variable mutations. Zero external dependencies.

## Installation

```bash
pnpm add @esmap/guard
```

## CSS Scoping

Adds an app-specific attribute to CSS selectors for style isolation:

```ts
import { applyCssScope, removeCssScope, scopeCssText } from '@esmap/guard';

// Apply CSS scope to a DOM element
const scopedRoot = applyCssScope(containerElement, {
  prefix: 'checkout', // adds data-esmap-scope="checkout" attribute
});

// Remove scope
removeCssScope(containerElement, { prefix: 'checkout' });

// Transform CSS text only (no DOM required)
const scoped = scopeCssText('.btn { color: red; }', 'checkout');
// -> '[data-esmap-scope="checkout"] .btn{ color: red; }'
```

Handles `@media`, `@keyframes`, and other at-rules correctly.

## Global Pollution Detection

Monitors whether MFEs add unexpected properties to `window`:

```ts
import { createGlobalGuard, snapshotGlobals, diffGlobals } from '@esmap/guard';

// Automatic monitoring via polling
const guard = createGlobalGuard({
  allowList: ['__REDUX_DEVTOOLS__'], // globals to ignore
  interval: 1000, // polling interval in ms (default: 1000)
  onViolation: (violation) => {
    console.warn(`Global pollution: ${violation.property} (${violation.type})`);
  },
});

// Manually trigger an immediate check
guard.check();

// Stop monitoring and get list of added globals
const addedGlobals = guard.dispose();

// Manual one-shot comparison
const before = snapshotGlobals();
// ... run MFE ...
const newGlobals = diffGlobals(before); // returns string[] of new global keys
```

## Style Isolation

Per-MFE style context with automatic scoping and dynamic style observation:

```ts
import { createStyleIsolation } from '@esmap/guard';

const isolation = createStyleIsolation({
  appName: 'checkout',
  container: document.getElementById('checkout-root')!,
  strategy: 'attribute', // 'attribute' (default) or 'shadow'
  observeDynamic: true, // watch for dynamically added styles
});

// Query
isolation.getScopedCount(); // number of scoped stylesheets

// Re-scope all styles (e.g., after DOM changes)
isolation.refresh();

// Cleanup — stops observer and removes scoping
isolation.destroy();
```

## Style Collector

Tracks and cleans up `<style>` and `<link>` tags dynamically added by MFEs:

```ts
import { createStyleCollector } from '@esmap/guard';

const collector = createStyleCollector();

// Start tracking styles for a specific app
collector.startCapture('checkout');

// MFE runs (dynamically adds style/link tags)

// Stop tracking and get captured elements
const capturedStyles = collector.stopCapture('checkout');

// Query styles for an app
collector.getStyles('checkout');

// Remove all styles for an app from the DOM
collector.removeStyles('checkout');

// Cleanup everything
collector.destroy();
```
