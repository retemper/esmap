import type { EsmapConfig } from '@esmap/shared';
import { ConfigValidationError, isRecord } from '@esmap/shared';

/** Validation error per config field */
export interface ConfigFieldError {
  readonly path: string;
  readonly message: string;
}

/**
 * Validates a config object. Returns a list of errors.
 * @param config - the config object to validate
 */
export function validateConfig(config: unknown): readonly ConfigFieldError[] {
  const errors: ConfigFieldError[] = [];

  if (!isRecord(config)) {
    errors.push({ path: '', message: 'Config must be an object' });
    return errors;
  }

  if (!isRecord(config.apps)) {
    errors.push({ path: 'apps', message: '"apps" field is required and must be an object' });
  } else {
    validateApps(config.apps, errors);
  }

  if (!config.shared || typeof config.shared !== 'object') {
    errors.push({ path: 'shared', message: '"shared" field is required and must be an object' });
  }

  if (config.server !== undefined) {
    validateServer(config.server, errors);
  }

  return errors;
}

/**
 * EsmapConfig type guard. Used for values that pass validateConfig without errors.
 * @param config - the config object to validate
 */
function isEsmapConfig(config: unknown): config is EsmapConfig {
  return validateConfig(config).length === 0;
}

/**
 * Returns the config in a type-safe manner if no validation errors exist. Throws ConfigValidationError otherwise.
 * @param config - the config object to validate
 */
export function assertValidConfig(config: unknown): EsmapConfig {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
  if (!isEsmapConfig(config)) {
    throw new ConfigValidationError([]);
  }
  return config;
}

/**
 * Validates the apps field.
 * @param apps - app configuration map
 * @param errors - accumulated error array
 */
function validateApps(apps: Record<string, unknown>, errors: ConfigFieldError[]): void {
  for (const [name, appConfig] of Object.entries(apps)) {
    if (!isRecord(appConfig)) {
      errors.push({ path: `apps.${name}`, message: 'App config must be an object' });
      continue;
    }

    if (typeof appConfig.path !== 'string' || appConfig.path.length === 0) {
      errors.push({ path: `apps.${name}.path`, message: '"path" is a required string' });
    }
  }
}

/**
 * Validates the server field.
 * @param server - server configuration object
 * @param errors - accumulated error array
 */
function validateServer(server: unknown, errors: ConfigFieldError[]): void {
  if (!isRecord(server)) {
    errors.push({ path: 'server', message: '"server" must be an object' });
    return;
  }

  if (
    server.port !== undefined &&
    (typeof server.port !== 'number' || server.port < 0 || server.port > 65535)
  ) {
    errors.push({ path: 'server.port', message: 'Port must be a number between 0 and 65535' });
  }

  if (server.storage !== undefined) {
    const validStorages = ['filesystem', 's3', 'redis'];
    if (typeof server.storage !== 'string' || !validStorages.includes(server.storage)) {
      errors.push({
        path: 'server.storage',
        message: `storage must be one of ${validStorages.join(', ')}`,
      });
    }
  }
}
