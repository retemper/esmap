/**
 * Browser runtime demo.
 * Demonstrates the integration of import map loader, app registry, router, devtools, and guard.
 *
 * This file is reference code (not directly executed) showing how to use the esmap
 * framework in a browser environment.
 */

// === 1. Import Map Loading ===

import { loadImportMap } from '@esmap/runtime';

// Fetches the import map from the server and injects it into the DOM.
// This function auto-generates a <script type="importmap"> tag
// and also auto-inserts modulepreload links.
async function bootstrapImportMap() {
  const importMap = await loadImportMap({
    importMapUrl: 'https://api.flex.team/importmap',
    // Or use a static import map:
    // inlineImportMap: { imports: { ... } },
    injectPreload: true,
  });

  console.log('Import map loaded:', Object.keys(importMap.imports).length, 'modules');
  return importMap;
}

// === 2. Devtools Override ===

import { applyOverrides, installDevtoolsApi, hasActiveOverrides } from '@esmap/devtools';

// Registers devtools API on window.__ESMAP__.
// Allows developers to override module URLs from the browser console.
//
// Usage examples (browser console):
//   __ESMAP__.override('@flex/checkout', 'http://localhost:5173/checkout.js')
//   __ESMAP__.overrides()     // Current override list
//   __ESMAP__.clearOverrides() // Clear all overrides
installDevtoolsApi();

async function loadImportMapWithOverrides() {
  const importMap = await bootstrapImportMap();

  // Applies overrides stored in localStorage to the import map.
  // Allows developers to test local builds in the production environment.
  if (hasActiveOverrides()) {
    const overridden = applyOverrides(importMap);
    console.warn('[esmap] devtools overrides active');
    return overridden;
  }

  return importMap;
}

// === 3. App Registration and Routing ===

import { AppRegistry, Router } from '@esmap/runtime';

const registry = new AppRegistry();

// Register each MFE app.
// activeWhen is a URL pattern; the app is mounted when the URL matches this pattern.
registry.registerApp({
  name: '@flex/people',
  activeWhen: '/people',
  container: '#app-main',
});

registry.registerApp({
  name: '@flex/payroll',
  activeWhen: '/payroll',
  container: '#app-main',
});

registry.registerApp({
  name: '@flex/time-tracking',
  activeWhen: ['/time-tracking', '/attendance'],
  container: '#app-main',
});

// GNB is always active on every page
registry.registerApp({
  name: '@flex/gnb',
  activeWhen: () => true,
  container: '#app-gnb',
});

// === 4. Performance Monitoring ===

import { PerfTracker } from '@esmap/monitor';

const perfTracker = new PerfTracker();

// Tracks app status changes to collect performance data.
registry.onStatusChange((event) => {
  if (event.to === 'LOADING') {
    perfTracker.markStart(event.appName, 'load');
  } else if (event.to === 'BOOTSTRAPPING') {
    perfTracker.markEnd(event.appName, 'load');
    perfTracker.markStart(event.appName, 'bootstrap');
  } else if (event.to === 'NOT_MOUNTED' && event.from === 'BOOTSTRAPPING') {
    perfTracker.markEnd(event.appName, 'bootstrap');
  } else if (event.to === 'MOUNTED') {
    perfTracker.markEnd(event.appName, 'mount');
  }
});

// === 5. CSS Isolation ===

import { applyCssScope, removeCssScope } from '@esmap/guard';

// Apply CSS scope when the app mounts, and remove it on unmount
registry.onStatusChange((event) => {
  const container = document.querySelector<HTMLElement>('#app-main');
  if (!container) return;

  if (event.to === 'MOUNTED') {
    applyCssScope(container, { prefix: event.appName });
  } else if (event.to === 'NOT_MOUNTED' && event.from === 'UNMOUNTING') {
    removeCssScope(container, { prefix: event.appName });
  }
});

// === 6. Full Boot Sequence ===

async function boot() {
  // 1) Load import map
  await loadImportMapWithOverrides();

  // 2) Start router — automatically mounts the app matching the current URL
  const router = new Router(registry, { mode: 'history' });
  await router.start();

  // 3) Output performance summary
  console.log('[esmap] Boot complete');

  // Performance summary after page load completes
  window.addEventListener('load', () => {
    const summary = perfTracker.summarize();
    for (const [appName, data] of summary) {
      console.log(`[perf] ${appName}: ${data.total.toFixed(1)}ms (${JSON.stringify(data.phases)})`);
    }
  });
}

// boot() is invoked from HTML
export { boot, registry, perfTracker };
