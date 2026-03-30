import { describe, it, expect } from 'vitest';
import { validateConfig, assertValidConfig } from './validate.js';
import type { EsmapConfig } from '@esmap/shared';
import { ConfigValidationError } from '@esmap/shared';

const VALID_CONFIG: EsmapConfig = {
  apps: {
    '@flex/checkout': { path: 'apps/checkout' },
    '@flex/people': { path: 'apps/people', activeWhen: '/people' },
  },
  shared: {
    react: { global: true },
    'react-dom': { global: true },
  },
};

describe('validateConfig', () => {
  it('returns no errors for a valid config', () => {
    const errors = validateConfig(VALID_CONFIG);
    expect(errors).toStrictEqual([]);
  });

  it('returns an error for null', () => {
    const errors = validateConfig(null);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('object');
  });

  it('returns an error when apps is missing', () => {
    const errors = validateConfig({ shared: {} });
    expect(errors.some((e) => e.path === 'apps')).toBe(true);
  });

  it('returns an error when shared is missing', () => {
    const errors = validateConfig({ apps: {} });
    expect(errors.some((e) => e.path === 'shared')).toBe(true);
  });

  it('returns an error when an app in apps is missing path', () => {
    const errors = validateConfig({
      apps: { '@flex/checkout': { notPath: 'x' } },
      shared: {},
    });
    expect(errors.some((e) => e.path === 'apps.@flex/checkout.path')).toBe(true);
  });

  it('returns an error when server.port is out of range', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { port: -1 },
    });
    expect(errors.some((e) => e.path === 'server.port')).toBe(true);
  });

  it('accepts server.port of 0 as valid', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { port: 0 },
    });
    expect(errors.filter((e) => e.path === 'server.port')).toStrictEqual([]);
  });

  it('accepts server.port of 65535 as valid', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { port: 65535 },
    });
    expect(errors.filter((e) => e.path === 'server.port')).toStrictEqual([]);
  });

  it('returns an error when server.storage is invalid', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { storage: 'mongodb' },
    });
    expect(errors.some((e) => e.path === 'server.storage')).toBe(true);
  });
});

describe('assertValidConfig', () => {
  it('returns a valid config as-is', () => {
    const result = assertValidConfig(VALID_CONFIG);
    expect(result).toStrictEqual(VALID_CONFIG);
  });

  it('throws ConfigValidationError for an invalid config', () => {
    expect(() => assertValidConfig(null)).toThrow(ConfigValidationError);

    try {
      assertValidConfig(null);
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      const err = e as ConfigValidationError;
      expect(err.code).toBe('CONFIG_VALIDATION_ERROR');
      expect(err.validationErrors.length).toBeGreaterThan(0);
    }
  });

  it('reports multiple errors at once', () => {
    try {
      assertValidConfig({});
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      const err = e as ConfigValidationError;
      expect(err.validationErrors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
