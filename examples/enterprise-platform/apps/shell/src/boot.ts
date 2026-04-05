/**
 * Enterprise Platform Shell — unified bootstrap.
 *
 * Demo points:
 * 1. Full plugin composition with createEsmap (guard, sandbox, keepAlive, domIsolation, prefetch, communication)
 * 2. ReadyGate blocks protected routes until authentication is complete
 * 3. Real-time import map server updates via SSE
 * 4. Shared dependency version negotiation (SharedModuleRegistry)
 * 5. DevTools panel + performance tracking
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
import { loadImportMap } from '@esmap/runtime';
import { createReadyGate } from '@esmap/communication';
import type { ImportMap } from '@esmap/shared';
import { auditLogPlugin } from './plugins/audit-log-plugin.js';
import { createDevtoolsPanel } from './devtools-panel.js';
import { createDevtoolsBridge } from './devtools-bridge.js';

// ─── DevTools panel reference (falls back to console before boot completes) ───
const devtoolsRef: { panel: { log: (msg: string) => void } | null } = { panel: null };

/** Outputs a log message to the DevTools panel or console */
function log(message: string): void {
  if (devtoolsRef.panel) {
    devtoolsRef.panel.log(message);
  } else {
    console.log(`[esmap] ${message}`);
  }
}

/** Platform-wide event map. Defines auth, activity, lifecycle, and workspace events */
type PlatformEvents = {
  'auth:login': { userId: string; name: string };
  'auth:logout': Record<string, never>;
  'activity:new': { type: string; message: string };
  lifecycle: { app: string; from: string; to: string };
  'workspace:context-change': { projectId: string; view: string };
  'team:member-select': { memberId: string; memberName: string };
  'team:member-deselect': Record<string, never>;
  'task:select': { taskId: string; title: string; assigneeId: string };
  'task:deselect': Record<string, never>;
  'task:status-change': { taskId: string; from: string; to: string; assigneeId: string };
  'notification:click': { type: string; targetId: string };
};

/** Workspace area state. Tracks project, member, task selection and notification count */
type WorkspaceState = {
  selectedProject: string | null;
  selectedMemberId: string | null;
  selectedTaskId: string | null;
  unreadNotifications: number;
};

/** Global state schema. Shared by all MFEs through the communication plugin */
type PlatformState = {
  theme: 'light' | 'dark';
  locale: string;
  currentApp: string;
  user: { id: string; name: string } | null;
  isAuthenticated: boolean;
  workspace: WorkspaceState;
};

// ─── Import map: fetch from server, use local fallback on failure ───
const IMPORT_MAP_SERVER = 'http://localhost:3200';

/** Fetches the current import map from the import map server. pnpm dev starts the server automatically */
async function fetchImportMap(): Promise<ImportMap> {
  const res = await fetch(IMPORT_MAP_SERVER);
  if (!res.ok) {
    throw new Error(`Import map server response failed: ${res.status}`);
  }
  const data: ImportMap = await res.json();
  log('[import map] Loaded from server');
  return data;
}

// ─── ReadyGate: block app mounting until authentication is complete ───
const gate = createReadyGate({ timeout: 30000 });
gate.register('auth');

// ─── Plugin initialization ───

// Custom plugin: audit log (demonstrates plugin authoring)
const audit = auditLogPlugin({
  maxEntries: 100,
  onLog: (entry) => {
    log(`[audit] ${entry.type}: ${entry.appName} — ${entry.detail}`);
  },
});

const smartPrefetch = intelligentPrefetchPlugin({
  persistKey: 'enterprise-prefetch',
  threshold: 0.15,
  maxPrefetch: 3,
});

const comm = communicationPlugin<PlatformEvents, PlatformState>({
  initialState: {
    theme: 'light',
    locale: 'ko',
    currentApp: '',
    user: null,
    isAuthenticated: false,
    workspace: {
      selectedProject: null,
      selectedMemberId: null,
      selectedTaskId: null,
      unreadNotifications: 0,
    },
  },
});

// Auth MFE -> Shell bridge: forwards CustomEvents to eventBus
// Uses window CustomEvent as a bridge for loose coupling between MFEs.
window.addEventListener('esmap:auth:login', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('auth:login', e.detail);
  }
});

// Workspace event bridge: forwards MFE CustomEvents to eventBus + globalState
window.addEventListener('esmap:team:member-select', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('team:member-select', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedMemberId: e.detail.memberId,
      },
    });
  }
});

window.addEventListener('esmap:team:member-deselect', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('team:member-deselect', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedMemberId: null,
      },
    });
  }
});

window.addEventListener('esmap:task:select', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('task:select', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedTaskId: e.detail.taskId,
      },
    });
  }
});

window.addEventListener('esmap:task:deselect', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('task:deselect', e.detail);
    comm.resources.globalState.setState({
      workspace: {
        ...comm.resources.globalState.getState().workspace,
        selectedTaskId: null,
      },
    });
  }
});

window.addEventListener('esmap:task:status-change', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('task:status-change', e.detail);
  }
});

window.addEventListener('esmap:notification:click', (e: Event) => {
  if (e instanceof CustomEvent) {
    comm.resources.eventBus.emit('notification:click', e.detail);
  }
});

// Subscribe to auth events -> ReadyGate integration
comm.resources.eventBus.on('auth:login', (payload) => {
  log(`Authentication complete: ${payload.name} (${payload.userId})`);
  comm.resources.globalState.setState({
    user: { id: payload.userId, name: payload.name },
    isAuthenticated: true,
  });
  gate.markReady('auth');

  // Hide auth container after authentication completes
  const authContainer = document.getElementById('app-auth');
  if (authContainer) authContainer.style.display = 'none';

  // Trigger router re-evaluation — activeWhen conditions changed, mount app matching current URL
  window.dispatchEvent(new PopStateEvent('popstate'));
});

comm.resources.eventBus.on('auth:logout', () => {
  log('Logged out');
  comm.resources.globalState.setState({
    user: null,
    isAuthenticated: false,
  });
});

comm.resources.globalState.subscribe((state, prev) => {
  if (state.currentApp !== prev.currentApp) {
    log(`Current app: ${state.currentApp}`);
  }
});

/** Initializes the entire framework and starts the router */
async function boot(): Promise<void> {
  log('Enterprise Platform boot starting');

  // 1. Load import map (server -> local fallback)
  const importMap = await fetchImportMap();
  await loadImportMap({ inlineImportMap: importMap, injectPreload: true });
  log('Import map injection complete');

  // 2. createEsmap — full plugin composition
  const esmap = createEsmap({
    router: {
      onNoMatch: (ctx) => {
        log(`404: ${ctx.pathname}`);
      },
    },
    config: {
      apps: {
        // Auth: active at root path (overlay modal, ReadyGate integration)
        '@enterprise/auth': {
          path: '/',
          activeWhen: '/',
          container: '#app-auth',
        },
        // Navigation bar: always visible after authentication
        // (nav is rendered directly by shell, not a separate MFE)

        // Dashboard: main page + nested Parcel demo (keepAlive -> dedicated container)
        '@enterprise/dashboard': {
          path: '/',
          activeWhen: (loc: Location) =>
            loc.pathname === '/' || loc.pathname === '/dashboard' || loc.pathname === '/index.html',
          container: '#app-dashboard',
        },
        // Team Directory: keepAlive state preservation demo (keepAlive -> dedicated container)
        '@enterprise/team-directory': {
          path: '/team',
          activeWhen: '/team',
          container: '#app-team',
        },
        // Activity Feed: standalone route + Parcel dual mode demo
        '@enterprise/activity-feed': {
          path: '/activity',
          activeWhen: '/activity',
          container: '#app-main',
        },
        // Legacy Settings: MF->import map migration demo
        '@enterprise/legacy-settings': {
          path: '/settings',
          activeWhen: '/settings',
          container: '#app-main',
        },
        // Task Board: task management in the workspace main area
        '@enterprise/task-board': {
          path: '/workspace',
          activeWhen: '/workspace',
          container: '#workspace-main',
        },
        // Notifications: displays notifications in the workspace header
        '@enterprise/notifications': {
          path: '/workspace',
          activeWhen: '/workspace',
          container: '#workspace-header',
        },
        // Team Sidebar: displays team directory in the workspace sidebar (sidebar mode of team-directory)
        '@enterprise/team-sidebar': {
          path: '/workspace',
          activeWhen: '/workspace',
          container: '#workspace-sidebar',
        },
      },
      shared: {
        react: {
          requiredVersion: '^19.0.0',
          singleton: true,
          eager: true,
        },
        'react-dom': {
          requiredVersion: '^19.0.0',
          singleton: true,
          eager: true,
        },
        '@enterprise/design-system': {
          requiredVersion: '^1.0.0',
          singleton: true,
        },
      },
      server: { port: 3200, storage: 'filesystem', storageOptions: { path: './data' } },
    },
    importMap,
    plugins: [
      guardPlugin({
        cssStrategy: 'attribute',
        observeDynamic: true,
        onGlobalViolation: (appName, prop) => {
          log(`Global pollution: ${appName} → ${prop}`);
        },
      }),
      sandboxPlugin({
        exclude: ['@enterprise/auth'], // auth needs global access
      }),
      keepAlivePlugin({
        apps: ['@enterprise/team-directory', '@enterprise/dashboard'],
        maxCached: 2,
      }),
      domIsolationPlugin({
        exclude: ['@enterprise/auth'],
        globalSelectors: [
          '#esmap-devtools',
          '#app-auth',
          '#app-nav',
          '#app-dashboard',
          '#app-team',
          '#app-workspace',
        ],
      }),
      smartPrefetch.plugin,
      comm.plugin,
      audit.plugin,
    ],
  });

  // ─── Create DevTools panel (in-page widget) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DevTools accepts wide types, so any cast is allowed
  const panel = createDevtoolsPanel({
    registry: esmap.registry,
    eventBus: comm.resources.eventBus as any,
    globalState: comm.resources.globalState,
    router: esmap.router,
    perf: esmap.perf as any,
    prefetch: smartPrefetch.controller,
    sharedModules: esmap.sharedModules as any,
    importMap,
  });
  devtoolsRef.panel = panel;

  // ─── Chrome DevTools Extension Bridge ───
  // postMessage is harmlessly ignored when no extension is present.
  createDevtoolsBridge({
    registry: esmap.registry,
    eventBus: comm.resources.eventBus as any,
    globalState: comm.resources.globalState,
    router: esmap.router,
    perf: esmap.perf as any,
    prefetch: smartPrefetch.controller,
    sharedModules: esmap.sharedModules as any,
    importMap,
  });

  // ─── Lifecycle hooks ───
  esmap.hooks.beforeEach('mount', (ctx) => {
    log(`Mount: ${ctx.appName}`);
    comm.resources.globalState.setState({ currentApp: ctx.appName });
  });

  esmap.hooks.afterEach('unmount', (ctx) => {
    log(`Cleanup: ${ctx.appName}`);
  });

  esmap.registry.onStatusChange((event) => {
    log(`${event.appName}: ${event.from} → ${event.to}`);
  });

  // ─── Route guard: protect before authentication ───
  esmap.router.beforeRouteChange((_from, to) => {
    if (!gate.isAllReady() && to.pathname !== '/' && to.pathname !== '/dashboard') {
      log(`Route blocked: authentication required (${to.pathname}) → redirecting to /`);
      history.replaceState(null, '', '/');
      return false;
    }
    return true;
  });

  esmap.router.afterRouteChange((_from, to) => {
    log(`Route: ${to.pathname}`);
    updateNavHighlight(to.pathname);
    toggleWorkspaceContainer(to.pathname);
  });

  log(`${esmap.registry.getApps().length} apps registered`);

  // ─── Render shell's own navigation bar ───
  renderNav();

  // ─── Start ───
  await esmap.start();
  log('Router started');

  // Display workspace container matching the initial route
  toggleWorkspaceContainer(window.location.pathname);

  // ─── SSE: real-time import map updates ───
  connectSSE();

  // Performance summary
  setTimeout(() => {
    const summary = esmap.perf.summarize();
    for (const [appName, data] of summary) {
      log(`${appName}: ${data.total.toFixed(0)}ms`);
    }
  }, 1000);
}

/** Renders the shell's own navigation bar in the DOM (managed directly by shell, not an MFE) */
function renderNav(): void {
  const nav = document.getElementById('app-nav');
  if (!nav) return;

  const links = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/team', label: 'Team' },
    { path: '/workspace', label: 'Workspace' },
    { path: '/activity', label: 'Activity' },
    { path: '/settings', label: 'Settings (Legacy)' },
  ];

  nav.innerHTML = `
    <div style="display:flex;align-items:center;gap:24px;width:100%">
      <strong style="font-size:16px;margin-right:auto">Enterprise Platform</strong>
      ${links
        .map(
          (l) =>
            `<a href="${l.path}" data-link style="color:#94a3b8;text-decoration:none;font-size:14px;padding:4px 0;border-bottom:2px solid transparent;transition:all 0.15s" data-path="${l.path}">${l.label}</a>`,
        )
        .join('')}
    </div>
  `;

  nav.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const target = el.closest<HTMLAnchorElement>('[data-link]');
    if (!target) return;
    e.preventDefault();
    const href = target.getAttribute('href') ?? '/';
    history.pushState(null, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    toggleWorkspaceContainer(href);
    updateNavHighlight(href);
  });
}

/** Highlights the navigation link matching the current path */
function updateNavHighlight(pathname: string): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('#app-nav [data-path]');
  for (const link of links) {
    const isActive =
      link.dataset.path === pathname || (pathname === '/' && link.dataset.path === '/dashboard');
    link.style.color = isActive ? '#ffffff' : '#94a3b8';
    link.style.borderBottomColor = isActive ? '#2563eb' : 'transparent';
  }
}

/** Shows the workspace container on the /workspace route, hides it otherwise */
function toggleWorkspaceContainer(pathname: string): void {
  const workspace = document.getElementById('app-workspace');
  if (!workspace) return;
  workspace.style.display = pathname === '/workspace' ? 'grid' : 'none';
}

/** Receives deploy/rollback events from the import map server in real-time via SSE */
function connectSSE(): void {
  try {
    const eventSource = new EventSource('http://localhost:3200/events');

    eventSource.addEventListener('import-map-update', (event) => {
      const data = JSON.parse(event.data);
      log(`[SSE] Deploy: ${data.service} → ${data.url}`);
    });

    eventSource.addEventListener('import-map-rollback', (event) => {
      const data = JSON.parse(event.data);
      log(`[SSE] Rollback: ${data.service} → ${data.rolledBackTo}`);
    });

    eventSource.onerror = () => {
      log('[SSE] Server disconnected (reconnecting)');
    };

    log('[SSE] Connected to import map server');
  } catch {
    log('[SSE] Server not running (offline mode)');
  }
}

boot().catch((error) => {
  log(`Boot failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
});
