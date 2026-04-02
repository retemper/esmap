import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Root directory of the enterprise-platform monorepo. */
const MONOREPO_ROOT = resolve(__dirname, '../..');

/**
 * Bare specifier-to-source-path mappings for packages that exist only in the
 * monorepo (not in node_modules).  In production builds these are marked
 * `external` and resolved at runtime via the shell's import map.  In dev mode
 * Vite cannot resolve them, so we point to the original source entry so that
 * Vite can transform and serve them with HMR.
 */
const DEV_ALIASES: Record<string, string> = {
  '@enterprise/design-system': resolve(MONOREPO_ROOT, 'packages/design-system/src/index.ts'),
  '@enterprise/activity-feed': resolve(MONOREPO_ROOT, 'apps/activity-feed/src/index.tsx'),
};

/**
 * Vite plugin that rewrites bare `@enterprise/*` specifiers to local source
 * paths during development.  This is a no-op in `build` mode because the
 * specifiers are already handled by `rollupOptions.external`.
 */
function mfeDevExternals(): Plugin {
  return {
    name: 'mfe-dev-externals',
    enforce: 'pre',

    config(_cfg, { command }) {
      if (command !== 'serve') {
        return;
      }

      return {
        resolve: {
          alias: DEV_ALIASES,
        },
      };
    },
  };
}

export { mfeDevExternals };
