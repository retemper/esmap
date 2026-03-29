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
  it('유효한 설정은 에러가 없다', () => {
    const errors = validateConfig(VALID_CONFIG);
    expect(errors).toStrictEqual([]);
  });

  it('null이면 에러를 반환한다', () => {
    const errors = validateConfig(null);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('객체');
  });

  it('apps가 없으면 에러를 반환한다', () => {
    const errors = validateConfig({ shared: {} });
    expect(errors.some((e) => e.path === 'apps')).toBe(true);
  });

  it('shared가 없으면 에러를 반환한다', () => {
    const errors = validateConfig({ apps: {} });
    expect(errors.some((e) => e.path === 'shared')).toBe(true);
  });

  it('apps에 path가 없는 앱이 있으면 에러를 반환한다', () => {
    const errors = validateConfig({
      apps: { '@flex/checkout': { notPath: 'x' } },
      shared: {},
    });
    expect(errors.some((e) => e.path === 'apps.@flex/checkout.path')).toBe(true);
  });

  it('server.port가 범위를 벗어나면 에러를 반환한다', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { port: -1 },
    });
    expect(errors.some((e) => e.path === 'server.port')).toBe(true);
  });

  it('server.port가 0이면 유효하다', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { port: 0 },
    });
    expect(errors.filter((e) => e.path === 'server.port')).toStrictEqual([]);
  });

  it('server.port가 65535이면 유효하다', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { port: 65535 },
    });
    expect(errors.filter((e) => e.path === 'server.port')).toStrictEqual([]);
  });

  it('server.storage가 유효하지 않으면 에러를 반환한다', () => {
    const errors = validateConfig({
      apps: {},
      shared: {},
      server: { storage: 'mongodb' },
    });
    expect(errors.some((e) => e.path === 'server.storage')).toBe(true);
  });
});

describe('assertValidConfig', () => {
  it('유효한 설정을 그대로 반환한다', () => {
    const result = assertValidConfig(VALID_CONFIG);
    expect(result).toStrictEqual(VALID_CONFIG);
  });

  it('유효하지 않은 설정이면 ConfigValidationError를 던진다', () => {
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

  it('여러 에러를 한번에 보고한다', () => {
    try {
      assertValidConfig({});
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      const err = e as ConfigValidationError;
      expect(err.validationErrors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
