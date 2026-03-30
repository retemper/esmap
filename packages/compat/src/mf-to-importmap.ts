import type { ImportMap } from '@esmap/shared';

/**
 * Webpack Module Federation exposed module declaration.
 * Corresponds to the exposes field in mf.config.ts.
 */
export interface MfExposedModule {
  /** Expose key (e.g., "./Button") */
  readonly key: string;
  /** File path (e.g., "./src/components/Button.tsx") */
  readonly path: string;
}

/**
 * Module Federation remote app configuration.
 * Represents the existing MF configuration that is the migration target.
 */
export interface MfRemoteConfig {
  /** App name (e.g., "flexCheckout") */
  readonly name: string;
  /** Scope name (e.g., "@flex/checkout") */
  readonly scope: string;
  /** App entry point URL (remoteEntry.js) */
  readonly remoteEntryUrl?: string;
  /** List of exposed modules */
  readonly exposes?: readonly MfExposedModule[];
}

/** Module Federation to import map conversion options */
export interface MfToImportMapOptions {
  /** CDN base URL */
  readonly cdnBase: string;
  /** Per-app build artifact path pattern (default: "{scope}/{entry}") */
  readonly pathPattern?: string;
}

/**
 * Converts Module Federation remote configurations into import map format.
 * Maps each remote app's scope as a bare specifier to its build artifact URL.
 *
 * @param remotes - list of MF remote app configurations
 * @param options - conversion options
 * @returns import map object
 */
export function convertMfToImportMap(
  remotes: readonly MfRemoteConfig[],
  options: MfToImportMapOptions,
): ImportMap {
  const cdnBase = options.cdnBase.replace(/\/+$/, '');
  const imports: Record<string, string> = {};

  for (const remote of remotes) {
    const scope = remote.scope;
    const appPath = scope.replace('@', '').replace('/', '-');

    // Main entry
    imports[scope] = `${cdnBase}/${appPath}/index.js`;

    // Exposed submodules
    if (remote.exposes) {
      for (const exposed of remote.exposes) {
        const subPath = exposed.key.replace('./', '');
        imports[`${scope}/${subPath}`] = `${cdnBase}/${appPath}/${subPath}.js`;
      }
    }
  }

  return { imports };
}

/**
 * Generates import map entries for shared libraries from MF shared dependency configuration.
 *
 * @param shared - shared library name to version mapping
 * @param cdnBase - CDN base URL
 * @returns the imports section of an import map
 */
export function convertMfSharedToImports(
  shared: Readonly<Record<string, string>>,
  cdnBase: string,
): Record<string, string> {
  const base = cdnBase.replace(/\/+$/, '');
  const imports: Record<string, string> = {};

  for (const [name, version] of Object.entries(shared)) {
    const safeName = name.replace('@', '').replace('/', '-');
    imports[name] = `${base}/shared/${safeName}@${version}.js`;
  }

  return imports;
}
