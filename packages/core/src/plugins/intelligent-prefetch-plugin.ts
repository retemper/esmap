/**
 * Intelligent prefetch plugin.
 * Automatically records router navigation events and
 * prefetches apps that are likely to be visited next from the current app.
 * Inspired by Garfish (ByteDance)'s intelligent preloading.
 */

import { createIntelligentPrefetch } from '@esmap/runtime';
import type { IntelligentPrefetchOptions, IntelligentPrefetchController } from '@esmap/runtime';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** Intelligent prefetch plugin options */
export interface IntelligentPrefetchPluginOptions extends IntelligentPrefetchOptions {
  /**
   * Delay time (ms) after navigation before starting prefetch.
   * Starts prefetching after the current app has stabilized.
   * Default 1000.
   */
  readonly prefetchDelay?: number;
  /**
   * List of container selectors to exclude from prefetch targets.
   * Apps mounted in these containers are ignored when determining the "current app".
   * Default [].
   */
  readonly excludeContainers?: readonly string[];
}

/** Intelligent prefetch plugin return value */
export interface IntelligentPrefetchPluginResult {
  /** Plugin to install */
  readonly plugin: EsmapPlugin;
  /** Controller accessible from the outside */
  readonly controller: IntelligentPrefetchController;
}

/** Default prefetch delay time */
const DEFAULT_PREFETCH_DELAY = 1000;

/**
 * Creates an intelligent prefetch plugin.
 * Returns a { plugin, controller } pattern like communicationPlugin,
 * allowing external access to learning data.
 *
 * @param options - intelligent prefetch plugin options
 * @returns plugin and controller
 */
export function intelligentPrefetchPlugin(
  options: IntelligentPrefetchPluginOptions = {},
): IntelligentPrefetchPluginResult {
  const { prefetchDelay = DEFAULT_PREFETCH_DELAY, excludeContainers = [], ...prefetchOptions } = options;
  const controller = createIntelligentPrefetch(prefetchOptions);

  const plugin: EsmapPlugin = {
    name: 'esmap:intelligent-prefetch',

    install(ctx: PluginContext): PluginCleanup {
      const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

      // Record navigation and execute predictive prefetch after route change
      const removeAfterGuard = ctx.router.afterRouteChange((_from, to) => {
        // Find current active app (ignore apps mounted in excluded containers)
        const activeApps = ctx.registry.getApps().filter((app) => app.status === 'MOUNTED');
        const currentAppName = activeApps.find(
          (app) => !excludeContainers.includes(app.container),
        )?.name;
        const previousAppName = _from.pathname !== to.pathname ? undefined : currentAppName;

        if (currentAppName) {
          controller.recordNavigation(previousAppName, currentAppName);
        }

        // Execute predictive prefetch after delay
        const timeout = setTimeout(() => {
          if (!currentAppName) return;

          const priorities = controller.getPriorities(currentAppName);
          for (const priority of priorities) {
            const prefetchedApps = ctx.prefetch.getPrefetchedApps();
            if (prefetchedApps.includes(priority.appName)) continue;

            // Only prefetch unloaded apps — resolves URLs from import map
            const app = ctx.registry.getApp(priority.appName);
            if (app && app.status === 'NOT_LOADED') {
              ctx.prefetch.prefetchByName(priority.appName);
            }
          }
        }, prefetchDelay);

        pendingTimeouts.push(timeout);
      });

      // Also track navigation via app status changes
      const removeStatusListener = ctx.registry.onStatusChange((event) => {
        if (event.to === 'MOUNTED') {
          // Find previously MOUNTED app and record the transition
          const mountedApps = ctx.registry
            .getApps()
            .filter((app) => app.status === 'MOUNTED' && app.name !== event.appName);

          const previousApp = mountedApps.find(
            (app) => !excludeContainers.includes(app.container),
          );
          controller.recordNavigation(previousApp?.name, event.appName);
        }
      });

      return () => {
        removeAfterGuard();
        removeStatusListener();
        for (const timeout of pendingTimeouts) {
          clearTimeout(timeout);
        }
        pendingTimeouts.length = 0;
        controller.persist();
      };
    },
  };

  return { plugin, controller };
}
