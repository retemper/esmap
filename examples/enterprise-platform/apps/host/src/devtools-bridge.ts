/**
 * esmap DevTools Bridge.
 *
 * Broadcasts esmap runtime events via window.postMessage so that
 * the Chrome DevTools Extension can receive them.
 * postMessage is harmlessly ignored when no extension is present.
 */

/** esmap data source options subscribed to by the DevTools bridge */
interface DevtoolsBridgeOptions {
  readonly registry: {
    readonly getApps: () => ReadonlyArray<{ name: string; status: string; container: string }>;
    readonly onStatusChange: (cb: (e: { appName: string; from: string; to: string }) => void) => () => void;
  };
  readonly eventBus: {
    readonly on: (event: string, handler: (...args: unknown[]) => void) => unknown;
    readonly getHistory: () => ReadonlyArray<{ event: string; payload: unknown; timestamp: number }>;
  };
  readonly globalState: {
    readonly getState: () => Record<string, unknown>;
    readonly subscribe: (cb: (newState: Record<string, unknown>, prevState: Record<string, unknown>) => void) => () => void;
  };
  readonly router: {
    readonly afterRouteChange: (cb: (from: { pathname: string }, to: { pathname: string }) => void) => void;
  };
  readonly perf: {
    readonly onMeasurement?: (cb: (m: { appName: string; phase: string; duration: number; startTime: number }) => void) => () => void;
  };
  readonly prefetch?: {
    readonly getStats: () => ReadonlyArray<{ from: string; to: string; count: number; ratio: number }>;
  };
  readonly sharedModules?: {
    readonly getRegistered: () => ReadonlyMap<string, ReadonlyArray<{ name: string; version: string; requiredVersion?: string; singleton?: boolean; eager?: boolean; from?: string }>>;
    readonly getLoaded: () => ReadonlyMap<string, { version: string; from?: string }>;
  };
  readonly importMap?: {
    readonly imports: Readonly<Record<string, string>>;
    readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  };
}

/** Broadcasts a message to the DevTools extension */
function send(payload: Record<string, unknown>): void {
  try {
    window.postMessage({ source: 'esmap-devtools', payload }, window.location.origin);
  } catch {
    // Ignore if the data contains non-serializable values
  }
}

/** Extracts only serializable fields from an app object */
function serializeApp(app: { name: string; status: string; container: string }): { name: string; status: string; container: string } {
  return { name: app.name, status: app.status, container: app.container };
}

/** Converts the shared module registry into a serializable format */
function serializeSharedModules(
  sm: NonNullable<DevtoolsBridgeOptions['sharedModules']>,
): { registered: Record<string, Array<Record<string, unknown>>>; loaded: Record<string, Record<string, unknown>> } {
  const registered: Record<string, Array<Record<string, unknown>>> = {};
  for (const [name, configs] of sm.getRegistered()) {
    registered[name] = configs.map((c) => ({
      name: c.name, version: c.version, requiredVersion: c.requiredVersion,
      singleton: c.singleton, eager: c.eager, from: c.from,
    }));
  }
  const loaded: Record<string, Record<string, unknown>> = {};
  for (const [name, info] of sm.getLoaded()) {
    loaded[name] = { version: info.version, from: info.from };
  }
  return { registered, loaded };
}

/** Determines the category from the event name */
function classifyEvent(eventName: string): string {
  if (eventName.includes('auth')) return 'auth';
  if (eventName.includes('route')) return 'route';
  if (eventName.includes('state')) return 'state';
  if (eventName.includes('error') || eventName.includes('fail')) return 'error';
  if (eventName.includes('team') || eventName.includes('task')) return 'lifecycle';
  if (eventName.includes('notification')) return 'lifecycle';
  return 'lifecycle';
}

/** Sets up the DevTools bridge. Works safely even without an extension */
export function createDevtoolsBridge(options: DevtoolsBridgeOptions): void {
  const { registry, eventBus, globalState, router, perf, prefetch, sharedModules, importMap } = options;

  /** State for snapshot capture */
  interface BridgeSnapshot {
    apps: Array<{ name: string; status: string; container: string }>;
    currentState: Record<string, unknown>;
    prefetchStats: Array<{ from: string; to: string; count: number; ratio: number }>;
  }

  const snapshot: BridgeSnapshot = {
    apps: registry.getApps().map(serializeApp),
    currentState: { ...globalState.getState() },
    prefetchStats: [],
  };

  if (prefetch) {
    try { snapshot.prefetchStats = [...prefetch.getStats()]; } catch { /* empty */ }
  }

  // Send initial INIT message
  send({
    type: 'ESMAP_INIT',
    apps: snapshot.apps,
    currentState: snapshot.currentState,
    prefetchStats: snapshot.prefetchStats,
    ...(sharedModules ? { sharedModules: serializeSharedModules(sharedModules) } : {}),
    ...(importMap ? { importMap } : {}),
  });

  // Receive Extension -> Page direction messages (snapshot requests, etc.)
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.source !== 'esmap-devtools-panel') return;

    const msg = event.data.payload;
    if (msg?.type === 'ESMAP_GET_SNAPSHOT') {
      send({
        type: 'ESMAP_INIT',
        apps: snapshot.apps,
        currentState: snapshot.currentState,
        prefetchStats: snapshot.prefetchStats,
        ...(sharedModules ? { sharedModules: serializeSharedModules(sharedModules) } : {}),
      });
    }
  });

  // Registry status changes
  registry.onStatusChange((event) => {
    // Update snapshot
    const idx = snapshot.apps.findIndex((a) => a.name === event.appName);
    if (idx >= 0) {
      snapshot.apps[idx] = { ...snapshot.apps[idx], status: event.to };
    }

    send({
      type: 'ESMAP_STATUS_CHANGE',
      appName: event.appName,
      from: event.from,
      to: event.to,
      timestamp: Date.now(),
    });
  });

  // Event bus — subscribe to known events
  const knownEvents = [
    'auth:login', 'auth:logout', 'activity:new', 'lifecycle',
    'team:member-select', 'team:member-deselect',
    'task:select', 'task:deselect', 'task:status-change',
    'notification:click',
  ];
  for (const eventName of knownEvents) {
    try {
      eventBus.on(eventName, (payload: unknown) => {
        send({
          type: 'ESMAP_EVENT',
          event: eventName,
          payload: JSON.stringify(payload),
          category: classifyEvent(eventName),
          timestamp: Date.now(),
        });
      });
    } catch { /* unsupported event */ }
  }

  // Subscribe to global state
  globalState.subscribe((newState, prevState) => {
    snapshot.currentState = { ...newState };
    send({
      type: 'ESMAP_STATE_CHANGE',
      newState: { ...newState },
      prevState: { ...prevState },
      timestamp: Date.now(),
    });

    if (prefetch) {
      try {
        snapshot.prefetchStats = [...prefetch.getStats()];
        send({
          type: 'ESMAP_PREFETCH_STATS',
          stats: snapshot.prefetchStats,
          timestamp: Date.now(),
        });
      } catch { /* empty */ }
    }
  });

  // Router events
  router.afterRouteChange((from, to) => {
    send({
      type: 'ESMAP_ROUTE_CHANGE',
      from: from.pathname,
      to: to.pathname,
      timestamp: Date.now(),
    });
  });

  // Subscribe to performance measurements
  if (perf.onMeasurement) {
    try {
      perf.onMeasurement((measurement) => {
        send({
          type: 'ESMAP_PERF',
          appName: measurement.appName,
          phase: measurement.phase,
          duration: measurement.duration,
          startTime: measurement.startTime,
          timestamp: Date.now(),
        });
      });
    } catch { /* empty */ }
  }

  // Send existing event history
  try {
    const history = eventBus.getHistory();
    for (const item of history) {
      send({
        type: 'ESMAP_EVENT',
        event: String(item.event),
        payload: JSON.stringify(item.payload),
        category: classifyEvent(String(item.event)),
        timestamp: item.timestamp,
      });
    }
  } catch { /* empty */ }

  console.log('[esmap] DevTools bridge active');
}
