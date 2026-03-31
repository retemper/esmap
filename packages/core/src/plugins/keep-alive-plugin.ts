/**
 * Keep-alive plugin.
 * Preserves DOM state during route transitions for designated apps, eliminating remount costs.
 * Inspired by wujie (Tencent)'s keep-alive pattern.
 *
 * How it works:
 * - On unmount: Hides the container instead of calling actual unmount (FROZEN state)
 * - On remount: Shows the container again for instant restoration (no mount call needed)
 * - Scroll positions, form input values, React component state, etc. are all preserved
 */

import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** Keep-alive plugin options */
export interface KeepAlivePluginOptions {
  /**
   * List of app names to apply keep-alive to.
   * Apps in this list will have their DOM preserved during route transitions.
   */
  readonly apps: readonly string[];
  /**
   * Maximum number of keep-alive apps. When exceeded, the oldest FROZEN app is actually unmounted.
   * Useful for limiting memory usage. Default Infinity (unlimited).
   */
  readonly maxCached?: number;
}

/**
 * Creates a keep-alive plugin.
 * Configures the registry so that designated apps preserve DOM state during route transitions.
 *
 * @param options - keep-alive plugin options
 * @returns EsmapPlugin instance
 */
export function keepAlivePlugin(options: KeepAlivePluginOptions): EsmapPlugin {
  const { apps, maxCached = Infinity } = options;
  /** Tracks FROZEN apps in chronological order for LRU eviction */
  const frozenOrder: string[] = [];

  return {
    name: 'esmap:keep-alive',

    install(ctx: PluginContext): PluginCleanup {
      // Set keep-alive on designated apps
      for (const appName of apps) {
        ctx.registry.setKeepAlive(appName, true);
      }

      // LRU eviction: actually unmount the oldest when FROZEN app count exceeds maxCached
      const removeStatusListener = ctx.registry.onStatusChange((event) => {
        if (event.to === 'FROZEN') {
          // If already tracked, remove and re-add at the end (LRU refresh)
          const idx = frozenOrder.indexOf(event.appName);
          if (idx >= 0) frozenOrder.splice(idx, 1);
          frozenOrder.push(event.appName);

          // Actually unmount the oldest FROZEN app when maxCached is exceeded
          while (frozenOrder.length > maxCached) {
            const evicted = frozenOrder.shift();
            if (evicted === undefined) break;
            ctx.registry.setKeepAlive(evicted, false);

            // Find FROZEN app and actually unmount it
            const app = ctx.registry.getApp(evicted);
            if (app && app.status === 'FROZEN') {
              // Make container visible again and execute unmount
              const container = document.querySelector<HTMLElement>(app.container);
              if (container) {
                container.style.display = '';
              }
              void ctx.registry.unmountApp(evicted).then(
                () => {
                  // Re-enable keep-alive after eviction (applies on next mount)
                  ctx.registry.setKeepAlive(evicted, true);
                },
                () => {
                  // Restore keep-alive even if unmount fails
                  ctx.registry.setKeepAlive(evicted, true);
                },
              );
            }
          }
        }

        if (event.to === 'MOUNTED' && event.from === 'FROZEN') {
          // Remove from frozenOrder on thaw
          const idx = frozenOrder.indexOf(event.appName);
          if (idx >= 0) frozenOrder.splice(idx, 1);
        }
      });

      return () => {
        removeStatusListener();
        frozenOrder.length = 0;
        for (const appName of apps) {
          ctx.registry.setKeepAlive(appName, false);
        }
      };
    },
  };
}
