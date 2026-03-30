/**
 * Base class for esmap framework errors.
 * All framework errors extend this class.
 */
export class EsmapError extends Error {
  /** Error code (machine-parseable) */
  readonly code: string;
  /** Underlying cause of the error */
  override readonly cause?: Error;

  constructor(code: string, message: string, cause?: Error) {
    super(message);
    this.name = 'EsmapError';
    this.code = code;
    this.cause = cause;
  }
}

/** Import map parsing/validation error */
export class ImportMapError extends EsmapError {
  constructor(message: string, cause?: Error) {
    super('IMPORT_MAP_ERROR', message, cause);
    this.name = 'ImportMapError';
  }
}

/** Import map merge conflict error */
export class ImportMapConflictError extends EsmapError {
  readonly specifier: string;

  constructor(specifier: string) {
    super('IMPORT_MAP_CONFLICT', `Import map conflict: "${specifier}" exists in both maps`);
    this.name = 'ImportMapConflictError';
    this.specifier = specifier;
  }
}

/** Manifest validation error */
export class ManifestValidationError extends EsmapError {
  readonly validationErrors: readonly string[];

  constructor(errors: readonly string[]) {
    super('MANIFEST_VALIDATION_ERROR', `Manifest validation failed:\n  - ${errors.join('\n  - ')}`);
    this.name = 'ManifestValidationError';
    this.validationErrors = errors;
  }
}

/** Config validation error */
export class ConfigValidationError extends EsmapError {
  readonly validationErrors: readonly { path: string; message: string }[];

  constructor(errors: readonly { path: string; message: string }[]) {
    const messages = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    super('CONFIG_VALIDATION_ERROR', `Config validation failed:\n${messages}`);
    this.name = 'ConfigValidationError';
    this.validationErrors = errors;
  }
}

/** App lifecycle error */
export class AppLifecycleError extends EsmapError {
  readonly appName: string;
  readonly phase: 'load' | 'bootstrap' | 'mount' | 'unmount';

  constructor(appName: string, phase: 'load' | 'bootstrap' | 'mount' | 'unmount', cause?: Error) {
    super(
      'APP_LIFECYCLE_ERROR',
      `App "${appName}" ${phase} failed${cause ? `: ${cause.message}` : ''}`,
      cause,
    );
    this.name = 'AppLifecycleError';
    this.appName = appName;
    this.phase = phase;
  }
}

/** Error thrown when an app is not registered */
export class AppNotFoundError extends EsmapError {
  readonly appName: string;

  constructor(appName: string) {
    super('APP_NOT_FOUND', `App "${appName}" is not registered`);
    this.name = 'AppNotFoundError';
    this.appName = appName;
  }
}

/** Error thrown when an app is already registered */
export class AppAlreadyRegisteredError extends EsmapError {
  readonly appName: string;

  constructor(appName: string) {
    super('APP_ALREADY_REGISTERED', `App "${appName}" is already registered`);
    this.name = 'AppAlreadyRegisteredError';
    this.appName = appName;
  }
}

/** Error thrown when a DOM container cannot be found */
export class ContainerNotFoundError extends EsmapError {
  readonly selector: string;

  constructor(selector: string) {
    super(
      'CONTAINER_NOT_FOUND',
      `Container "${selector}" not found. ` +
        `Verify that an element matching this selector exists in the HTML and that the container option is correct when registering the app.`,
    );
    this.name = 'ContainerNotFoundError';
    this.selector = selector;
  }
}

/** Import map load failure error */
export class ImportMapLoadError extends EsmapError {
  readonly url?: string;
  readonly status?: number;

  constructor(message: string, options?: { url?: string; status?: number; cause?: Error }) {
    super('IMPORT_MAP_LOAD_ERROR', message, options?.cause);
    this.name = 'ImportMapLoadError';
    this.url = options?.url;
    this.status = options?.status;
  }
}
