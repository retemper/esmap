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
  it('parses a valid JSON string', () => {
    const result = parseManifest(JSON.stringify(VALID_MANIFEST));
    expect(result).toStrictEqual(VALID_MANIFEST);
  });

  it('throws an error for invalid JSON', () => {
    expect(() => parseManifest('not-json')).toThrow();
  });
});

describe('validateManifest', () => {
  it('passes a valid manifest object', () => {
    const result = validateManifest(VALID_MANIFEST);
    expect(result).toStrictEqual(VALID_MANIFEST);
  });

  it('throws ManifestValidationError for null', () => {
    expect(() => validateManifest(null)).toThrow(ManifestValidationError);
  });

  it('throws an error when name is missing', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, name: '' })).toThrow('"name"');
  });

  it('throws an error when version is missing', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, version: '' })).toThrow('"version"');
  });

  it('throws an error when entry is missing', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, entry: '' })).toThrow('"entry"');
  });

  it('throws an error when assets is not an array', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, assets: 'not-array' })).toThrow('"assets"');
  });

  it('throws an error when dependencies.shared is not an array', () => {
    expect(() =>
      validateManifest({ ...VALID_MANIFEST, dependencies: { shared: 'invalid', internal: [] } }),
    ).toThrow('"dependencies.shared"');
  });

  it('throws an error when modulepreload is not an array', () => {
    expect(() => validateManifest({ ...VALID_MANIFEST, modulepreload: 'invalid' })).toThrow(
      '"modulepreload"',
    );
  });

  it('reports multiple errors at once', () => {
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
  it('generates URLs from CDN base and app path', () => {
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

  it('strips trailing slash from CDN base', () => {
    const result = resolveManifestUrls(VALID_MANIFEST, 'https://cdn.flex.team/', 'apps/checkout');
    expect(result.entryUrl).toBe('https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js');
  });

  it('strips leading and trailing slashes from app path', () => {
    const result = resolveManifestUrls(VALID_MANIFEST, 'https://cdn.flex.team', '/apps/checkout/');
    expect(result.entryUrl).toBe('https://cdn.flex.team/apps/checkout/checkout-a1b2c3.js');
  });
});
