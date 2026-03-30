/**
 * Audit log custom plugin.
 * Collects app lifecycle events as structured logs and provides
 * extension points for forwarding to external systems (Sentry, DataDog, etc.).
 *
 * Demo points:
 * - How to directly implement the esmap plugin interface (EsmapPlugin)
 * - Accessing registry, router, hooks, and perf via PluginContext
 * - Plugin cleanup pattern
 */

import type { EsmapPlugin, PluginContext, PluginCleanup } from '@esmap/core';

/** Audit log entry */
interface AuditLogEntry {
  readonly timestamp: number;
  readonly type: 'mount' | 'unmount' | 'route' | 'error';
  readonly appName: string;
  readonly detail: string;
}

/** Audit log plugin options */
interface AuditLogPluginOptions {
  /** Maximum number of entries to retain */
  readonly maxEntries?: number;
  /** Callback for external forwarding when a log is generated */
  readonly onLog?: (entry: AuditLogEntry) => void;
}

/** Audit log plugin return value */
interface AuditLogPluginResult {
  /** The plugin to install */
  readonly plugin: EsmapPlugin;
  /** Accessor for retrieving collected logs */
  readonly getEntries: () => readonly AuditLogEntry[];
}

/**
 * Creates an audit log plugin that tracks app lifecycle events.
 * Follows the same { plugin, accessor } pattern as communicationPlugin.
 *
 * @param options - plugin options
 * @returns the plugin and log accessor
 */
export function auditLogPlugin(
  options: AuditLogPluginOptions = {},
): AuditLogPluginResult {
  const { maxEntries = 200, onLog } = options;
  const entries: AuditLogEntry[] = [];

  /** Adds an entry and removes the oldest when max count is exceeded */
  function addEntry(entry: AuditLogEntry): void {
    entries.push(entry);
    while (entries.length > maxEntries) {
      entries.shift();
    }
    onLog?.(entry);
  }

  const plugin: EsmapPlugin = {
    name: 'enterprise:audit-log',

    install(ctx: PluginContext): PluginCleanup {
      // Track mount/unmount
      ctx.hooks.afterEach('mount', (hookCtx) => {
        addEntry({
          timestamp: Date.now(),
          type: 'mount',
          appName: hookCtx.appName,
          detail: `mount complete`,
        });
      });

      ctx.hooks.afterEach('unmount', (hookCtx) => {
        addEntry({
          timestamp: Date.now(),
          type: 'unmount',
          appName: hookCtx.appName,
          detail: `unmount complete`,
        });
      });

      // Track route changes
      const removeRouteGuard = ctx.router.afterRouteChange((_from, to) => {
        const activeApps = ctx.registry.getApps().filter((app) => app.status === 'MOUNTED');
        addEntry({
          timestamp: Date.now(),
          type: 'route',
          appName: activeApps[0]?.name ?? 'unknown',
          detail: `route: ${to.pathname}`,
        });
      });

      // Track app load errors
      const removeStatusListener = ctx.registry.onStatusChange((event) => {
        if (event.to === 'LOAD_ERROR') {
          addEntry({
            timestamp: Date.now(),
            type: 'error',
            appName: event.appName,
            detail: `status error: ${event.to}`,
          });
        }
      });

      return () => {
        removeRouteGuard();
        removeStatusListener();
        entries.length = 0;
      };
    },
  };

  return {
    plugin,
    getEntries: () => [...entries],
  };
}
