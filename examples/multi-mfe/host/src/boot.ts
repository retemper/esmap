/**
 * Host app bootstrap — based on @esmap/core.
 *
 * Example of how 340 lines of manual wire-up code became concise with the
 * @esmap/core kernel + plugin system. A single createEsmap() initializes the entire framework.
 */

import {
  createEsmap,
  guardPlugin,
  sandboxPlugin,
  communicationPlugin,
  keepAlivePlugin,
  domIsolationPlugin,
  intelligentPrefetchPlugin,
} from '@esmap/core';
import { createDevtoolsOverlay } from '@esmap/devtools';
import { loadImportMap } from '@esmap/runtime';
import type { ImportMap } from '@esmap/shared';

// ─── 1. Status log UI ───
const statusLog = document.getElementById('status-log')!;

/** Adds a log to the status panel */
function log(message: string): void {
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  statusLog.appendChild(line);

  while (statusLog.children.length > 30) {
    statusLog.removeChild(statusLog.firstChild!);
  }
}

// ─── 2. Import map definition ───
const BASE_URL = '/apps';

const importMap: ImportMap = {
  imports: {
    'app-nav': `${BASE_URL}/app-nav/app-nav.js`,
    'app-home': `${BASE_URL}/app-home/app-home.js`,
    'app-settings': `${BASE_URL}/app-settings/app-settings.js`,
    'app-react-dashboard': `${BASE_URL}/app-react-dashboard/app-react-dashboard.js`,
    'app-broken': `${BASE_URL}/app-broken/app-broken.js`,
  },
};

// ─── 3. Plugin initialization ───
const smartPrefetch = intelligentPrefetchPlugin({
  persistKey: 'esmap-demo-prefetch',
  threshold: 0.15,
  maxPrefetch: 2,
});

const comm = communicationPlugin({
  initialState: {
    theme: 'light' as const,
    locale: 'ko',
    currentApp: '',
  },
});

comm.resources.globalState.subscribe((state, prev) => {
  if (state.currentApp !== prev.currentApp) {
    log(`Current app: ${state.currentApp}`);
  }
});

comm.resources.eventBus.on('app:message', (payload) => {
  log(`App message: ${JSON.stringify(payload)}`);
});

// Wildcard subscription — log all events with 'app:' prefix
comm.resources.eventBus.onAny('app:*', (payload) => {
  log(`[Wildcard] app event: ${JSON.stringify(payload)}`);
});

// ─── 4. Boot ───
async function boot(): Promise<void> {
  log('Boot started');

  // Inject import map into DOM
  await loadImportMap({
    inlineImportMap: importMap,
    injectPreload: true,
  });
  log('Import map injected');

  // createEsmap — initialize entire framework in one call
  const esmap = createEsmap({
    router: {
      onNoMatch: (ctx) => {
        log(`404: No matching app for ${ctx.pathname}`);
      },
    },
    config: {
      apps: {
        'app-nav': {
          path: '/',
          activeWhen: () => true,
          container: '#app-nav',
        },
        'app-home': {
          path: '/',
          activeWhen: (loc: Location) => loc.pathname === '/' || loc.pathname === '/index.html',
          container: '#app-main',
        },
        'app-settings': {
          path: '/settings',
          container: '#app-main',
        },
        'app-react-dashboard': {
          path: '/react',
          container: '#app-main',
        },
        'app-broken': {
          path: '/broken',
          container: '#app-broken',
        },
      },
      shared: {},
      server: { port: 3000, storage: { type: 'filesystem', path: './data' } },
    },
    importMap,
    plugins: [
      guardPlugin({
        cssStrategy: 'attribute',
        observeDynamic: true,
        onGlobalViolation: (appName, prop) => {
          log(`Global pollution detected: ${appName} → ${prop}`);
        },
      }),
      sandboxPlugin({
        exclude: ['app-nav'], // nav is always mounted, no need for sandbox
      }),
      keepAlivePlugin({
        apps: ['app-home', 'app-settings', 'app-react-dashboard'],
        maxCached: 3,
      }),
      domIsolationPlugin({
        exclude: ['app-nav'], // nav is global navigation, no need for DOM isolation
        globalSelectors: ['#status-log', '#app-nav'],
      }),
      smartPrefetch.plugin,
      comm.plugin,
    ],
  });

  // Lifecycle logging hooks
  esmap.hooks.beforeEach('mount', (ctx) => {
    log(`${ctx.appName} preparing to mount`);
    comm.resources.globalState.setState({ currentApp: ctx.appName });
  });

  esmap.hooks.afterEach('unmount', (ctx) => {
    log(`${ctx.appName} cleanup complete`);
  });

  // App status change logging
  esmap.registry.onStatusChange((event) => {
    log(`${event.appName}: ${event.from} → ${event.to}`);
    comm.resources.eventBus.emit('lifecycle', {
      app: event.appName,
      from: event.from,
      to: event.to,
    });
  });

  log(`${esmap.registry.getApps().length} apps registered`);

  // DevTools overlay (Alt+Shift+D)
  const overlay = createDevtoolsOverlay({ position: 'top-right' });

  // Route guard
  esmap.router.beforeRouteChange((from, to) => {
    log(`Route guard: ${from.pathname} → ${to.pathname}`);
    return true;
  });

  esmap.router.afterRouteChange((_from, to) => {
    log(`Route transition complete: ${to.pathname}`);

    // Update overlay app list
    overlay.update(
      esmap.registry.getApps().map((app) => ({
        name: app.name,
        status: app.status,
        container: app.container,
      })),
    );
  });

  // Programmatic navigation API demo
  // esmap.router.push('/settings')  — navigate to settings page
  // esmap.router.replace('/react')  — replace current URL
  // esmap.router.back()             — go back

  // Start!
  await esmap.start();
  log('Router started');

  // Performance summary
  setTimeout(() => {
    const summary = esmap.perf.summarize();
    for (const [appName, data] of summary) {
      log(`${appName}: ${data.total.toFixed(0)}ms`);
    }
  }, 500);
}

boot().catch((error) => {
  log(`Boot failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
});
