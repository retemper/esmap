import { describe, it, expect } from 'vitest';
import { parseManifest, validateManifest, resolveManifestUrls } from './manifest.js';
import type { MfeManifest } from '../types/manifest.js';
import { ManifestValidationError } from '../errors.js';

const VALID_MANIFEST: MfeManifest = {
  name: '@flex/checkout',
  version: '2.1.0',
  entry: 'checkout-a1b2c3.js',
  assets: ['checkout-a1b2c3.js', 'checkout-styles-p6q7r8.css'],
  dependencies: {
    shared: ['react', 'react-dom'],
    internal: ['@flex-packages/router'],
  },
  modulepreload: ['checkout-a1b2c3.js', 'checkout-page-home-s9t0u1.js'],
};

describe('parseManifest', () => {
  it('유효한 JSON 문자열을 파싱한다', () => {
    const result = parseManifest(JSON.stringify(VALID_MANIFEST));
    expect(result).toStrictEqual(VALID_MANIFEST);
  });

  it('잘못된 JSON이면 에러를 던진다', () => {
    expect(() => parseManifest('not-json')).toThrow();
  });
});

describe('validateManifest', () => {
  it('유효한 매니페스트 객체를 통과시킨다', () => {
    const result = validateManifest(VALID_MANIFEST);
    expect(result).toStrictEqual(VALID_MANIFEST);
  });

  it('null이면 ManifestValidationError를 던진다', () => {
    expect(() => validateManifest(null)).toThrow(ManifestValidationError);
  });

  it('name이 없으면 에러를 던진다', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, name: '' })).toThrow('"name"');
  });

  it('version이 없으면 에러를 던진다', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, version: '' })).toThrow('"version"');
  });

  it('entry가 없으면 에러를 던진다', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, entry: '' })).toThrow('"entry"');
  });

  it('assets가 배열이 아니면 에러를 던진다', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, assets: 'not-array' })).toThrow('"assets"');
  });

  it('dependencies.shared가 배열이 아니면 에러를 던진다', () => {
    expect(() =>
      validateManifest({ ...VALID_MANIFEST, dependencies: { shared: 'invalid', internal: [] } }),
    ).toThrow('"dependencies.shared"');
  });

  it('modulepreload가 배열이 아니면 에러를 던진다', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, modulepreload: 'invalid' })).toThrow(
      '"modulepreload"',
    );
  });

  it('여러 에러를 한번에 보고한다', () => {
    try {
      validateManifest({ name: '', version: '', entry: '' });
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      const err = e as ManifestValidationError;
      expect(err.validationErrors.length).toBeGreaterThan(3);
      expect(err.code).toBe('MANIFEST_VALIDATION_ERROR');
    }
  });
});

describe('resolveManifestUrls', () => {
  it('CDN base와 app path로 URL을 생성한다', () => {
    const result = resolveManifestUrls(VALID_MANIFEST, 'https://cdn.flex.team', 'apps/checkout');

    expect(result.entryUrl).toBe('https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js');
    expect(result.assetUrls).toStrictEqual([
      'https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js',
      'https://cdn.flex.team/apps/checkout/checkout-styles-p6q7r8.css',
    ]);
    expect(result.preloadUrls).toStrictEqual([
      'https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js',
      'https://cdn.flex.team/apps/checkout/checkout-page-home-s9t0u1.js',
    ]);
  });

  it('CDN base 끝의 슬래시를 제거한다', () => {
    const result = resolveManifestUrls(VALID_MANIFEST, 'https://cdn.flex.team/', 'apps/checkout');
    expect(result.entryUrl).toBe('https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js');
  });

  it('app path 앞뒤의 슬래시를 제거한다', () => {
    const result = resolveManifestUrls(VALID_MANIFEST, 'https://cdn.flex.team', '/apps/checkout/');
    expect(result.entryUrl).toBe('https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js');
  });
});
