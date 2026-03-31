/**
 * Devtools inspector for examining runtime framework state.
 * Allows querying event bus, shared module, and app registry state from the console.
 *
 * Design principle: The inspector does not directly import framework packages.
 * Instead, it receives runtime object references via `connect()` to maintain loose coupling.
 */

/** Minimal interface for inspecting the event bus */
interface InspectableEventBus {
  readonly getHistory: (event?: string) => ReadonlyArray<{
    readonly event: string;
    readonly payload: unknown;
    readonly timestamp: number;
  }>;
  readonly listenerCount: (event: string) => number;
}

/** Minimal interface for inspecting the shared module registry */
interface InspectableSharedModules {
  readonly getRegistered: () => ReadonlyMap<
    string,
    ReadonlyArray<{
      readonly name: string;
      readonly version: string;
      readonly requiredVersion?: string;
      readonly singleton?: boolean;
      readonly eager?: boolean;
      readonly from?: string;
    }>
  >;
  readonly getLoaded: () => ReadonlyMap<
    string,
    {
      readonly version: string;
      readonly module: unknown;
      readonly from?: string;
    }
  >;
}

/** Minimal interface for inspecting the app registry */
interface InspectableRegistry {
  readonly getApps: () => ReadonlyArray<{
    readonly name: string;
    readonly status: string;
    readonly container: string;
  }>;
}

/** Resources connectable to the inspector */
interface InspectorConnections {
  readonly eventBus?: InspectableEventBus;
  readonly sharedModules?: InspectableSharedModules;
  readonly registry?: InspectableRegistry;
}

/** DevTools Inspector interface */
export interface DevtoolsInspector {
  /** Connects runtime resources. Multiple calls retain the latest connection. */
  connect(connections: InspectorConnections): void;
  /** Prints event bus history to the console */
  events(filter?: string): void;
  /** Prints the listener count for a specific event */
  listeners(event: string): void;
  /** Prints shared module registration/loading status to the console */
  shared(): void;
  /** Prints the app status list to the console */
  apps(): void;
  /** Checks connection status */
  status(): void;
}

/**
 * Creates a DevTools Inspector.
 * After connecting runtime resources via `connect()`, you can query event/module/app state.
 *
 * @example
 * ```ts
 * const inspector = createDevtoolsInspector();
 * inspector.connect({ eventBus: comm.resources.eventBus, sharedModules, registry });
 * inspector.events();       // full event history
 * inspector.events('user:*'); // only events starting with 'user:'
 * inspector.shared();       // shared module state
 * inspector.apps();         // app state
 * ```
 *
 * @returns DevtoolsInspector instance
 */
export function createDevtoolsInspector(): DevtoolsInspector {
  const connections: { current: InspectorConnections } = { current: {} };

  return {
    connect(conns: InspectorConnections): void {
      connections.current = conns;
      console.log('[esmap:inspector] Connected:', formatConnectionStatus(conns));
    },

    events(filter?: string): void {
      const bus = connections.current.eventBus;
      if (!bus) {
        console.warn('[esmap:inspector] EventBus is not connected. Call connect() first.');
        return;
      }

      const history = bus.getHistory();
      const filtered = filter
        ? history.filter((record) => matchesPattern(record.event, filter))
        : history;

      if (filtered.length === 0) {
        console.log(`[esmap:inspector] No event history${filter ? ` (filter: "${filter}")` : ''}`);
        return;
      }

      console.group(
        `[esmap:inspector] Event history (${filtered.length} entries${filter ? `, filter: "${filter}"` : ''})`,
      );
      for (const record of filtered) {
        const time = new Date(record.timestamp).toISOString().slice(11, 23);
        console.log(`[${time}] ${record.event}`, record.payload);
      }
      console.groupEnd();
    },

    listeners(event: string): void {
      const bus = connections.current.eventBus;
      if (!bus) {
        console.warn('[esmap:inspector] EventBus is not connected.');
        return;
      }

      const count = bus.listenerCount(event);
      console.log(`[esmap:inspector] "${event}" listeners: ${count}`);
    },

    shared(): void {
      const modules = connections.current.sharedModules;
      if (!modules) {
        console.warn('[esmap:inspector] SharedModuleRegistry is not connected.');
        return;
      }

      const registered = modules.getRegistered();
      const loaded = modules.getLoaded();

      console.group(
        `[esmap:inspector] Shared modules (registered: ${registered.size}, loaded: ${loaded.size})`,
      );

      for (const [name, candidates] of registered) {
        const loadedInfo = loaded.get(name);
        const status = loadedInfo ? `loaded v${loadedInfo.version}` : 'not loaded';
        const versions = candidates.map((c) => c.version).join(', ');
        const flags: string[] = [];
        if (candidates.some((c) => c.singleton)) flags.push('singleton');
        if (candidates.some((c) => c.eager)) flags.push('eager');
        const from = loadedInfo?.from ? ` (from: ${loadedInfo.from})` : '';

        console.log(
          `  ${name}: [${versions}] → ${status}${from}${flags.length > 0 ? ` [${flags.join(', ')}]` : ''}`,
        );
      }

      console.groupEnd();
    },

    apps(): void {
      const registry = connections.current.registry;
      if (!registry) {
        console.warn('[esmap:inspector] AppRegistry is not connected.');
        return;
      }

      const apps = registry.getApps();
      if (apps.length === 0) {
        console.log('[esmap:inspector] No registered apps');
        return;
      }

      console.group(`[esmap:inspector] App list (${apps.length})`);
      for (const app of apps) {
        console.log(`  ${app.name}: ${app.status} → ${app.container}`);
      }
      console.groupEnd();
    },

    status(): void {
      console.log(
        '[esmap:inspector] Connection status:',
        formatConnectionStatus(connections.current),
      );
    },
  };
}

/**
 * Checks whether a wildcard pattern matches an event name.
 * 'user:*' matches all events starting with 'user:'.
 * Without a wildcard, performs exact match.
 * @param event - event name
 * @param pattern - matching pattern (supports wildcard *)
 */
function matchesPattern(event: string, pattern: string): boolean {
  if (pattern.endsWith('*')) {
    return event.startsWith(pattern.slice(0, -1));
  }
  return event === pattern;
}

/**
 * Formats connection status as a human-readable string.
 * @param conns - current connection state
 */
function formatConnectionStatus(conns: InspectorConnections): string {
  const parts: string[] = [];
  parts.push(`EventBus: ${conns.eventBus ? 'connected' : 'disconnected'}`);
  parts.push(`SharedModules: ${conns.sharedModules ? 'connected' : 'disconnected'}`);
  parts.push(`Registry: ${conns.registry ? 'connected' : 'disconnected'}`);
  return parts.join(', ');
}
