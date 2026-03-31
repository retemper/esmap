/**
 * Top-level configuration schema for esmap.config.ts.
 * Use the defineConfig() helper for type-safe authoring.
 */
export interface EsmapConfig {
  /** List of MFE apps */
  readonly apps: Readonly<Record<string, AppConfig>>;
  /** Shared dependency list */
  readonly shared: Readonly<Record<string, SharedConfig>>;
  /** Import map server configuration */
  readonly server?: ServerConfig;
  /** Developer tools configuration */
  readonly devtools?: DevtoolsConfig;
  /** CDN base URL */
  readonly cdnBase?: string;
}

/** Configuration for a single MFE app */
export interface AppConfig {
  /** App path prefix on CDN (e.g., "apps/checkout") */
  readonly path: string;
  /** Manifest file path (relative to local build) */
  readonly manifestPath?: string;
  /** Active route pattern (e.g., "/checkout", ["/checkout", "/cart"]) or custom matching function */
  readonly activeWhen?: string | readonly string[] | ((location: Location) => boolean);
  /** DOM container selector for mounting */
  readonly container?: string;
}

/** Shared dependency configuration */
export interface SharedConfig {
  /** Whether to share globally (same instance across all MFEs) */
  readonly global?: boolean;
  /** URL on CDN (auto-generated but can be manually overridden) */
  readonly url?: string;
  /** Subpath exports mapping (e.g., { "./client": "react-dom/client" }) */
  readonly subpaths?: Readonly<Record<string, string>>;
  /** Required version range (semver, e.g., "^18.0.0") */
  readonly requiredVersion?: string;
  /** Enforce a single instance across all MFEs */
  readonly singleton?: boolean;
  /** Load eagerly instead of lazily */
  readonly eager?: boolean;
  /** Strict mode on version mismatch (true: throw error, false: warn only) */
  readonly strictVersion?: boolean;
}

/** Import map server configuration */
export interface ServerConfig {
  /** Server port */
  readonly port?: number;
  /** Storage type */
  readonly storage?: 'filesystem' | 's3' | 'redis';
  /** Additional options per storage type */
  readonly storageOptions?: Readonly<Record<string, unknown>>;
  /** Authentication configuration */
  readonly auth?: AuthConfig;
}

/** Authentication configuration */
export interface AuthConfig {
  /** Authentication method */
  readonly type: 'api-key' | 'none';
  /** List of API keys (can reference environment variables, e.g., "$ESMAP_API_KEY") */
  readonly keys?: readonly string[];
}

/** Developer tools configuration */
export interface DevtoolsConfig {
  /** Whether devtools is enabled */
  readonly enabled?: boolean;
  /** Override application mode */
  readonly overrideMode?: 'native-merge' | 'shim';
  /** Devtools trigger keyboard shortcut */
  readonly trigger?: string;
}
