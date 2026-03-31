import { describe, it, expect } from 'vitest';
import { resolveConfig } from './defaults.js';
import type { EsmapConfig } from '@esmap/shared';

const MINIMAL_CONFIG: EsmapConfig = {
  apps: { '@flex/checkout': { path: 'apps/checkout' } },
  shared: { react: { global: true } },
};

describe('resolveConfig', () => {
  it('fills in server defaults', () => {
    const result = resolveConfig(MINIMAL_CONFIG);

    expect(result.server.port).toBe(3100);
    expect(result.server.storage).toBe('filesystem');
    expect(result.server.auth.type).toBe('none');
  });

  it('fills in devtools defaults', () => {
    const result = resolveConfig(MINIMAL_CONFIG);

    expect(result.devtools.enabled).toBe(true);
    expect(result.devtools.overrideMode).toBe('native-merge');
    expect(result.devtools.trigger).toBe('Alt+D');
  });

  it('defaults cdnBase to an empty string', () => {
    const result = resolveConfig(MINIMAL_CONFIG);
    expect(result.cdnBase).toBe('');
  });

  it('user settings override defaults', () => {
    const config: EsmapConfig = {
      ...MINIMAL_CONFIG,
      cdnBase: 'https://cdn.flex.team',
      server: { port: 8080, storage: 's3' },
      devtools: { enabled: false, trigger: 'Ctrl+Shift+D' },
    };

    const result = resolveConfig(config);

    expect(result.cdnBase).toBe('https://cdn.flex.team');
    expect(result.server.port).toBe(8080);
    expect(result.server.storage).toBe('s3');
    expect(result.devtools.enabled).toBe(false);
    expect(result.devtools.trigger).toBe('Ctrl+Shift+D');
  });

  it('passes apps and shared through as-is', () => {
    const result = resolveConfig(MINIMAL_CONFIG);

    expect(result.apps).toStrictEqual(MINIMAL_CONFIG.apps);
    expect(result.shared).toStrictEqual(MINIMAL_CONFIG.shared);
  });
});
