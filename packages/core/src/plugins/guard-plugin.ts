/**
 * CSS isolation + global pollution detection plugin.
 * Automatically applies CSS scoping and global guards on app mount,
 * and cleans up on unmount.
 */

import {
  applyCssScope,
  removeCssScope,
  createStyleIsolation,
  createGlobalGuard,
} from '@esmap/guard';
import type { StyleIsolationHandle, GlobalGuardHandle, CssScopeOptions } from '@esmap/guard';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** Guard plugin options */
export interface GuardPluginOptions {
  /** CSS isolation strategy. Default 'attribute'. */
  readonly cssStrategy?: 'attribute' | 'shadow';
  /** Whether to watch for dynamic style additions via MutationObserver. Default true. */
  readonly observeDynamic?: boolean;
  /** Whether to enable global pollution detection. Default true. */
  readonly detectGlobalPollution?: boolean;
  /** Global pollution allow list */
  readonly globalAllowList?: readonly string[];
  /** Callback invoked when global pollution is detected */
  readonly onGlobalViolation?: (appName: string, property: string) => void;
}

/** Per-app isolation state */
interface AppIsolation {
  readonly styleHandle: StyleIsolationHandle;
  readonly guardHandle: GlobalGuardHandle | null;
}

/**
 * Creates a CSS isolation + global pollution detection plugin.
 * Automatically applies CSS scoping and global guards on mount, and cleans up on unmount.
 *
 * @param options - guard plugin options
 * @returns EsmapPlugin instance
 */
export function guardPlugin(options: GuardPluginOptions = {}): EsmapPlugin {
  const {
    cssStrategy = 'attribute',
    observeDynamic = true,
    detectGlobalPollution = true,
    globalAllowList = [],
    onGlobalViolation,
  } = options;

  return {
    name: 'esmap:guard',

    install(ctx: PluginContext): PluginCleanup {
      const isolations = new Map<string, AppIsolation>();

      ctx.hooks.afterEach('mount', (hookCtx) => {
        const appName = hookCtx.appName;
        const app = ctx.registry.getApp(appName);
        if (!app) return;

        const container = document.querySelector<HTMLElement>(app.container);
        if (!container) return;

        applyCssScope(container, { prefix: appName } satisfies CssScopeOptions);

        const styleHandle = createStyleIsolation({
          appName,
          container,
          strategy: cssStrategy,
          observeDynamic,
        });

        const guardHandle = detectGlobalPollution
          ? createGlobalGuard({
              allowList: [...globalAllowList],
              onViolation: (violation) => {
                onGlobalViolation?.(appName, violation.property);
              },
            })
          : null;

        isolations.set(appName, { styleHandle, guardHandle });
      });

      ctx.hooks.beforeEach('unmount', (hookCtx) => {
        const appName = hookCtx.appName;
        const isolation = isolations.get(appName);
        if (!isolation) return;

        isolation.styleHandle.destroy();
        isolation.guardHandle?.dispose();

        const app = ctx.registry.getApp(appName);
        if (app) {
          const container = document.querySelector<HTMLElement>(app.container);
          if (container) {
            removeCssScope(container, { prefix: appName });
          }
        }

        isolations.delete(appName);
      });

      return () => {
        for (const [, isolation] of isolations) {
          isolation.styleHandle.destroy();
          isolation.guardHandle?.dispose();
        }
        isolations.clear();
      };
    },
  };
}
