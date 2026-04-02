/**
 * JavaScript sandbox plugin.
 * Automatically activates ProxySandbox on app mount and deactivates on unmount.
 * Isolates window property modifications per app to prevent global pollution.
 */

import { ProxySandbox } from '@esmap/sandbox';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** Sandbox plugin options */
export interface SandboxPluginOptions {
  /** Proxy sandbox allowList. Uses ProxySandbox defaults if not specified. */
  readonly allowList?: readonly PropertyKey[];
  /**
   * List of app names to exclude from sandboxing.
   * Shell apps or trusted apps can be excluded.
   */
  readonly exclude?: readonly string[];
}

/**
 * Creates a JavaScript sandbox plugin.
 * Activates ProxySandbox on app mount and deactivates on unmount.
 *
 * @param options - sandbox plugin options
 * @returns EsmapPlugin instance
 */
export function sandboxPlugin(options: SandboxPluginOptions = {}): EsmapPlugin {
  const { allowList, exclude = [] } = options;
  const excludeSet = new Set(exclude);

  return {
    name: 'esmap:sandbox',

    install(ctx: PluginContext): PluginCleanup {
      const sandboxes = new Map<string, ProxySandbox>();

      ctx.hooks.beforeEach('mount', (hookCtx) => {
        const appName = hookCtx.appName;
        if (excludeSet.has(appName)) return;

        const sandbox = new ProxySandbox({ name: appName, allowList });
        sandbox.activate();
        sandboxes.set(appName, sandbox);
      });

      ctx.hooks.afterEach('unmount', (hookCtx) => {
        const appName = hookCtx.appName;
        const sandbox = sandboxes.get(appName);
        if (!sandbox) return;

        sandbox.deactivate();
        sandboxes.delete(appName);
      });

      return () => {
        for (const [, sandbox] of sandboxes) {
          sandbox.deactivate();
        }
        sandboxes.clear();
      };
    },
  };
}
