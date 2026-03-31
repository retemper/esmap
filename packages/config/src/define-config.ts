import type { EsmapConfig } from '@esmap/shared';

/**
 * Helper to create a type-safe configuration object. Used in esmap.config.ts.
 * @param config - framework configuration object
 */
export function defineConfig(config: EsmapConfig): EsmapConfig {
  return config;
}
