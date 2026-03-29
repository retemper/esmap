import { describe, it, expect } from 'vitest';
import { generateImportMap } from './generate-import-map.js';
import type { EsmapConfig, MfeManifest, SharedDependencyManifest } from '@esmap/shared';

const TEST_CONFIG: EsmapConfig = {
  apps: {
    '@flex/checkout': { path: 'apps/checkout' },
    '@flex/people': { path: 'apps/people' },
  },
  shared: {
    react: { global: true },
    'react-dom': { global: true },
  },
  cdnBase: 'https://cdn.flex.team',
};

const TEST_MANIFESTS: Record<string, MfeManifest> = {
  '@flex/checkout': {
    name: '@flex/checkout',
    version: '2.1.0',
    entry: 'checkout-a1b2c3.js',
    assets: ['checkout-a1b2c3.js'],
    dependencies: { shared: ['react', 'react-dom'], internal: [] },
    modulepreload: ['checkout-a1b2c3.js', 'checkout-home-d4e5f6.js'],
  },
  '@flex/people': {
    name: '@flex/people',
    version: '1.0.0',
    entry: 'people-g7h8i9.js',
    assets: ['people-g7h8i9.js'],
    dependencies: { shared: ['react'], internal: [] },
    modulepreload: ['people-g7h8i9.js'],
  },
};

const TEST_SHARED_MANIFESTS: Record<string, SharedDependencyManifest> = {
  react: {
    name: 'react',
    version: '18.3.1',
    exports: {
      '.': 'shared/react@18.3.1/react-abc123.js',
      './jsx-runtime': 'shared/react@18.3.1/jsx-runtime-def456.js',
    },
  },
  'react-dom': {
    name: 'react-dom',
    version: '18.3.1',
    exports: {
      '.': 'shared/react-dom@18.3.1/react-dom-ghi789.js',
      './client': 'shared/react-dom@18.3.1/client-jkl012.js',
    },
  },
};

describe('generateImportMap', () => {
  it('MFE 앱 엔트리를 import map에 포함한다', () => {
    const result = generateImportMap({
      config: TEST_CONFIG,
      manifests: TEST_MANIFESTS,
    });

    expect(result.importMap.imports['@flex/checkout']).toBe(
      'https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js',
    );
    expect(result.importMap.imports['@flex/people']).toBe(
      'https://cdn.flex.team/apps/people/people-g7h8i9.js',
    );
  });

  it('공유 의존성 매니페스트로 imports를 생성한다', () => {
    const result = generateImportMap({
      config: TEST_CONFIG,
      manifests: TEST_MANIFESTS,
      sharedManifests: TEST_SHARED_MANIFESTS,
    });

    expect(result.importMap.imports['react']).toBe(
      'https://cdn.flex.team/shared/react@18.3.1/react-abc123.js',
    );
    expect(result.importMap.imports['react/jsx-runtime']).toBe(
      'https://cdn.flex.team/shared/react@18.3.1/jsx-runtime-def456.js',
    );
    expect(result.importMap.imports['react-dom']).toBe(
      'https://cdn.flex.team/shared/react-dom@18.3.1/react-dom-ghi789.js',
    );
    expect(result.importMap.imports['react-dom/client']).toBe(
      'https://cdn.flex.team/shared/react-dom@18.3.1/client-jkl012.js',
    );
  });

  it('공유 의존성에 url이 명시되면 그대로 사용한다', () => {
    const config: EsmapConfig = {
      ...TEST_CONFIG,
      shared: {
        react: { global: true, url: 'https://esm.sh/react@18.3.1' },
      },
    };

    const result = generateImportMap({ config, manifests: {} });

    expect(result.importMap.imports['react']).toBe('https://esm.sh/react@18.3.1');
  });

  it('매니페스트가 없는 앱은 건너뛴다', () => {
    const result = generateImportMap({
      config: TEST_CONFIG,
      manifests: { '@flex/checkout': TEST_MANIFESTS['@flex/checkout'] },
    });

    expect(result.importMap.imports['@flex/checkout']).toBeDefined();
    expect(result.importMap.imports['@flex/people']).toBeUndefined();
  });

  it('modulepreload 힌트를 반환한다', () => {
    const result = generateImportMap({
      config: TEST_CONFIG,
      manifests: TEST_MANIFESTS,
    });

    expect(result.preloadHints['@flex/checkout']).toStrictEqual([
      'https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js',
      'https://cdn.flex.team/apps/checkout/checkout-home-d4e5f6.js',
    ]);
    expect(result.preloadHints['@flex/people']).toStrictEqual([
      'https://cdn.flex.team/apps/people/people-g7h8i9.js',
    ]);
  });

  it('JSON 출력은 유효한 JSON이다', () => {
    const result = generateImportMap({
      config: TEST_CONFIG,
      manifests: TEST_MANIFESTS,
      sharedManifests: TEST_SHARED_MANIFESTS,
    });

    const parsed = JSON.parse(result.json);
    expect(parsed.imports).toBeDefined();
  });

  it('scopes가 없으면 import map에 포함하지 않는다', () => {
    const result = generateImportMap({
      config: TEST_CONFIG,
      manifests: TEST_MANIFESTS,
    });

    expect(result.importMap.scopes).toBeUndefined();
  });

  it('cdnBase가 없으면 빈 문자열로 처리한다', () => {
    const config: EsmapConfig = {
      apps: { '@flex/a': { path: 'apps/a' } },
      shared: {},
    };
    const manifests: Record<string, MfeManifest> = {
      '@flex/a': {
        name: '@flex/a',
        version: '1.0.0',
        entry: 'a-123.js',
        assets: ['a-123.js'],
        dependencies: { shared: [], internal: [] },
        modulepreload: [],
      },
    };

    const result = generateImportMap({ config, manifests });

    expect(result.importMap.imports['@flex/a']).toBe('/apps/a/a-123.js');
  });

  it('cdnBase 끝의 슬래시를 제거한다', () => {
    const config: EsmapConfig = {
      ...TEST_CONFIG,
      cdnBase: 'https://cdn.flex.team/',
    };

    const result = generateImportMap({
      config,
      manifests: TEST_MANIFESTS,
    });

    expect(result.importMap.imports['@flex/checkout']).toBe(
      'https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js',
    );
  });

  it('공유 의존성 exports의 절대 URL은 cdnBase를 붙이지 않는다', () => {
    const sharedManifests: Record<string, SharedDependencyManifest> = {
      react: {
        name: 'react',
        version: '18.3.1',
        exports: {
          '.': 'https://other-cdn.com/react.js',
        },
      },
    };

    const result = generateImportMap({
      config: TEST_CONFIG,
      manifests: {},
      sharedManifests,
    });

    expect(result.importMap.imports['react']).toBe('https://other-cdn.com/react.js');
  });
});
