import { describe, it, expect } from 'vitest';
import {
  EsmapError,
  ImportMapError,
  ImportMapConflictError,
  ManifestValidationError,
  ConfigValidationError,
  AppLifecycleError,
  AppNotFoundError,
  AppAlreadyRegisteredError,
  ContainerNotFoundError,
  ImportMapLoadError,
} from './errors.js';

describe('EsmapError', () => {
  it('has code, message, and cause', () => {
    const cause = new Error('cause');
    const error = new EsmapError('TEST_CODE', 'test message', cause);

    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('test message');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('EsmapError');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ImportMapError', () => {
  it('has IMPORT_MAP_ERROR code', () => {
    const error = new ImportMapError('parsing failed');
    expect(error.code).toBe('IMPORT_MAP_ERROR');
    expect(error.name).toBe('ImportMapError');
    expect(error).toBeInstanceOf(EsmapError);
  });
});

describe('ImportMapConflictError', () => {
  it('includes the conflicting specifier', () => {
    const error = new ImportMapConflictError('react');
    expect(error.specifier).toBe('react');
    expect(error.code).toBe('IMPORT_MAP_CONFLICT');
    expect(error.message).toContain('react');
  });
});

describe('ManifestValidationError', () => {
  it('includes the list of validation errors', () => {
    const errors = ['"name" is required', '"version" is required'];
    const error = new ManifestValidationError(errors);
    expect(error.validationErrors).toStrictEqual(errors);
    expect(error.code).toBe('MANIFEST_VALIDATION_ERROR');
  });
});

describe('ConfigValidationError', () => {
  it('includes error list by path', () => {
    const errors = [{ path: 'apps', message: 'required' }];
    const error = new ConfigValidationError(errors);
    expect(error.validationErrors).toStrictEqual(errors);
    expect(error.message).toContain('apps');
  });
});

describe('AppLifecycleError', () => {
  it('includes the app name and phase', () => {
    const cause = new Error('network error');
    const error = new AppLifecycleError('@flex/checkout', 'load', cause);
    expect(error.appName).toBe('@flex/checkout');
    expect(error.phase).toBe('load');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('@flex/checkout');
    expect(error.message).toContain('load');
  });

  it('can be created without a cause', () => {
    const error = new AppLifecycleError('@flex/checkout', 'mount');
    expect(error.cause).toBeUndefined();
  });
});

describe('AppNotFoundError', () => {
  it('includes the app name', () => {
    const error = new AppNotFoundError('@flex/checkout');
    expect(error.appName).toBe('@flex/checkout');
    expect(error.code).toBe('APP_NOT_FOUND');
  });
});

describe('AppAlreadyRegisteredError', () => {
  it('includes the app name', () => {
    const error = new AppAlreadyRegisteredError('@flex/checkout');
    expect(error.appName).toBe('@flex/checkout');
    expect(error.code).toBe('APP_ALREADY_REGISTERED');
  });
});

describe('ContainerNotFoundError', () => {
  it('includes the selector', () => {
    const error = new ContainerNotFoundError('#app');
    expect(error.selector).toBe('#app');
    expect(error.code).toBe('CONTAINER_NOT_FOUND');
  });
});

describe('ImportMapLoadError', () => {
  it('includes the URL and status code', () => {
    const error = new ImportMapLoadError('load failed', {
      url: 'https://api.example.com/importmap',
      status: 500,
    });
    expect(error.url).toBe('https://api.example.com/importmap');
    expect(error.status).toBe(500);
    expect(error.code).toBe('IMPORT_MAP_LOAD_ERROR');
  });

  it('can be created without options', () => {
    const error = new ImportMapLoadError('missing required options');
    expect(error.url).toBeUndefined();
    expect(error.status).toBeUndefined();
  });
});
