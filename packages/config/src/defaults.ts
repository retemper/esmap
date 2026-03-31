import type { EsmapConfig, ServerConfig, DevtoolsConfig } from '@esmap/shared';

/** Default server configuration */
const DEFAULT_SERVER_CONFIG: Required<ServerConfig> = {
  port: 3100,
  storage: 'filesystem',
  storageOptions: {},
  auth: { type: 'none' },
};

/** Default devtools configuration */
const DEFAULT_DEVTOOLS_CONFIG: Required<DevtoolsConfig> = {
  enabled: true,
  overrideMode: 'native-merge',
  trigger: 'Alt+D',
};

/**
 * Returns a fully resolved config by merging defaults into user-provided settings.
 * @param config - user-defined configuration
 */
export function resolveConfig(config: EsmapConfig): ResolvedConfig {
  return {
    apps: config.apps,
    shared: config.shared,
    cdnBase: config.cdnBase ?? '',
    server: { ...DEFAULT_SERVER_CONFIG, ...config.server },
    devtools: { ...DEFAULT_DEVTOOLS_CONFIG, ...config.devtools },
  };
}

/** Fully resolved configuration type with all defaults filled in */
export interface ResolvedConfig {
  readonly apps: EsmapConfig['apps'];
  readonly shared: EsmapConfig['shared'];
  readonly cdnBase: string;
  readonly server: Required<ServerConfig>;
  readonly devtools: Required<DevtoolsConfig>;
}
