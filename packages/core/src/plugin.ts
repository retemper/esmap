/**
 * esmap plugin system.
 * Provides extension points with access to all framework subsystems.
 */

import type { AppRegistry, Router, LifecycleHooks, PrefetchController } from '@esmap/runtime';
import type { PerfTracker } from '@esmap/monitor';

/** Function to be executed during plugin cleanup */
export type PluginCleanup = () => void | Promise<void>;

/** Context passed to plugin install. Provides access to all framework subsystems. */
export interface PluginContext {
  /** App registry — registers, loads, mounts/unmounts apps */
  readonly registry: AppRegistry;
  /** Router — URL-based app activation */
  readonly router: Router;
  /** Lifecycle hooks — before/after global/per-app hooks */
  readonly hooks: LifecycleHooks;
  /** Performance tracker — automatic lifecycle instrumentation */
  readonly perf: PerfTracker;
  /** Prefetch controller */
  readonly prefetch: PrefetchController;
}

/**
 * esmap plugin interface.
 * Extends the framework by receiving PluginContext in the install method.
 * Returned cleanup functions are executed in reverse order during destroy.
 */
export interface EsmapPlugin {
  /** Plugin identifier name */
  readonly name: string;
  /**
   * Installs the plugin into the framework.
   * If a cleanup function is returned, it is automatically called during destroy.
   * @param ctx - framework subsystem access context
   */
  install(ctx: PluginContext): PluginCleanup | void;
}

/**
 * Installs a list of plugins in order and collects cleanup functions.
 * @param plugins - array of plugins to install
 * @param ctx - plugin context
 * @returns array of cleanup functions (in install order)
 */
export function installPlugins(
  plugins: readonly EsmapPlugin[],
  ctx: PluginContext,
): readonly PluginCleanup[] {
  const cleanups: PluginCleanup[] = [];
  const installed = new Set<string>();

  for (const plugin of plugins) {
    if (installed.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already installed`);
    }
    installed.add(plugin.name);

    const cleanup = plugin.install(ctx);
    if (cleanup) {
      cleanups.push(cleanup);
    }
  }

  return cleanups;
}

/**
 * Executes cleanup functions in reverse order.
 * Cleans up in reverse installation order to prevent dependency issues.
 * @param cleanups - array of cleanup functions to execute
 */
export async function runCleanups(cleanups: readonly PluginCleanup[]): Promise<void> {
  const reversed = [...cleanups].reverse();
  for (const cleanup of reversed) {
    await cleanup();
  }
}
