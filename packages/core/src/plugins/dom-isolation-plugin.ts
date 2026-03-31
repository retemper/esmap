/**
 * DOM query isolation plugin.
 * Scopes document query methods to app containers on mount,
 * and restores originals on unmount.
 * Inspired by micro-app (JD.com)'s Element Isolation pattern.
 */

import { createDomIsolation } from '@esmap/sandbox';
import type { DomIsolationHandle } from '@esmap/sandbox';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** DOM isolation plugin options */
export interface DomIsolationPluginOptions {
  /**
   * List of app names to exclude from DOM isolation.
   * Used for apps that need full document access, such as global navigation.
   */
  readonly exclude?: readonly string[];
  /**
   * Global selector patterns. Queries matching these patterns bypass container isolation.
   * Example: ['#global-modal', '[data-esmap-global]']
   */
  readonly globalSelectors?: readonly string[];
}

/**
 * Creates a DOM query isolation plugin.
 * Scopes document.querySelector and similar methods to app containers on mount.
 *
 * @param options - DOM isolation plugin options
 * @returns EsmapPlugin instance
 */
export function domIsolationPlugin(options: DomIsolationPluginOptions = {}): EsmapPlugin {
  const { exclude = [], globalSelectors = [] } = options;
  const excludeSet = new Set(exclude);

  return {
    name: 'esmap:dom-isolation',

    install(ctx: PluginContext): PluginCleanup {
      const handles = new Map<string, DomIsolationHandle>();

      ctx.hooks.afterEach('mount', (hookCtx) => {
        const appName = hookCtx.appName;
        if (excludeSet.has(appName)) return;

        const app = ctx.registry.getApp(appName);
        if (!app) return;

        const container = document.querySelector<HTMLElement>(app.container);
        if (!container) return;

        const handle = createDomIsolation({
          name: appName,
          container,
          globalSelectors,
        });
        handles.set(appName, handle);
      });

      ctx.hooks.beforeEach('unmount', (hookCtx) => {
        const appName = hookCtx.appName;
        const handle = handles.get(appName);
        if (!handle) return;

        handle.dispose();
        handles.delete(appName);
      });

      return () => {
        for (const [, handle] of handles) {
          handle.dispose();
        }
        handles.clear();
      };
    },
  };
}
