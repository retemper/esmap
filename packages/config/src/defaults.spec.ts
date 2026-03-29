import { describe, it, expect } from 'vitest';
import { resolveConfig } from './defaults.js';
import type { EsmapConfig } from '@esmap/shared';

const MINIMAL_CONFIG: EsmapConfig = {
  apps: { '@flex/checkout': { path: 'apps/checkout' } },
  shared: { react: { global: true } },
};

describe('resolveConfig', () => {
  it('서버 기본값을 채운다', () => {
    const result = resolveConfig(MINIMAL_CONFIG);

    expect(result.server.port).toBe(3100);
    expect(result.server.storage).toBe('filesystem');
    expect(result.server.auth.type).toBe('none');
  });

  it('devtools 기본값을 채운다', () => {
    const result = resolveConfig(MINIMAL_CONFIG);

    expect(result.devtools.enabled).toBe(true);
    expect(result.devtools.overrideMode).toBe('native-merge');
    expect(result.devtools.trigger).toBe('Alt+D');
  });

  it('cdnBase 기본값은 빈 문자열이다', () => {
    const result = resolveConfig(MINIMAL_CONFIG);
    expect(result.cdnBase).toBe('');
  });

  it('사용자 설정이 기본값을 덮어쓴다', () => {
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

  it('apps와 shared를 그대로 전달한다', () => {
    const result = resolveConfig(MINIMAL_CONFIG);

    expect(result.apps).toStrictEqual(MINIMAL_CONFIG.apps);
    expect(result.shared).toStrictEqual(MINIMAL_CONFIG.shared);
  });
});
