import { describe, it, expect } from 'vitest';
import { createImportMapResolver } from './import-map-resolver.js';

describe('createImportMapResolver', () => {
  describe('basic specifier resolution', () => {
    it('resolves an exact match from the imports map', () => {
      const resolver = createImportMapResolver({
        imports: { react: 'https://cdn.example.com/react.js' },
      });

      expect(resolver.resolve('react')).toBe('https://cdn.example.com/react.js');
    });

    it('resolves scoped package specifiers', () => {
      const resolver = createImportMapResolver({
        imports: { '@myorg/checkout': 'https://cdn.example.com/checkout-a1b2.js' },
      });

      expect(resolver.resolve('@myorg/checkout')).toBe('https://cdn.example.com/checkout-a1b2.js');
    });

    it('throws for unmapped specifiers', () => {
      const resolver = createImportMapResolver({ imports: {} });

      expect(() => resolver.resolve('unknown-module')).toThrow(
        'Cannot resolve specifier "unknown-module"',
      );
    });

    it('passes through absolute URLs as-is', () => {
      const resolver = createImportMapResolver({ imports: {} });

      expect(resolver.resolve('https://cdn.example.com/mod.js')).toBe(
        'https://cdn.example.com/mod.js',
      );
    });
  });

  describe('package path prefix matching (trailing slash)', () => {
    it('resolves subpaths via trailing slash prefix', () => {
      const resolver = createImportMapResolver({
        imports: { 'lodash/': 'https://cdn.example.com/lodash/' },
      });

      expect(resolver.resolve('lodash/debounce')).toBe('https://cdn.example.com/lodash/debounce');
    });

    it('matches the longest prefix first', () => {
      const resolver = createImportMapResolver({
        imports: {
          'lodash/': 'https://cdn.example.com/lodash-v1/',
          'lodash/fp/': 'https://cdn.example.com/lodash-fp/',
        },
      });

      expect(resolver.resolve('lodash/fp/map')).toBe('https://cdn.example.com/lodash-fp/map');
      expect(resolver.resolve('lodash/debounce')).toBe(
        'https://cdn.example.com/lodash-v1/debounce',
      );
    });
  });

  describe('scope-based resolution', () => {
    it('uses the scope mapping when referrer URL matches', () => {
      const resolver = createImportMapResolver({
        imports: { react: 'https://cdn.example.com/react-18.js' },
        scopes: {
          'https://cdn.example.com/legacy/': {
            react: 'https://cdn.example.com/react-17.js',
          },
        },
      });

      expect(resolver.resolve('react', 'https://cdn.example.com/legacy/app.js')).toBe(
        'https://cdn.example.com/react-17.js',
      );
    });

    it('falls back to top-level imports when no scope matches', () => {
      const resolver = createImportMapResolver({
        imports: { react: 'https://cdn.example.com/react-18.js' },
        scopes: {
          'https://cdn.example.com/legacy/': {
            react: 'https://cdn.example.com/react-17.js',
          },
        },
      });

      expect(resolver.resolve('react', 'https://cdn.example.com/modern/app.js')).toBe(
        'https://cdn.example.com/react-18.js',
      );
    });

    it('matches the longest scope prefix first', () => {
      const resolver = createImportMapResolver({
        imports: { react: 'https://cdn.example.com/react-default.js' },
        scopes: {
          'https://cdn.example.com/': {
            react: 'https://cdn.example.com/react-broad.js',
          },
          'https://cdn.example.com/apps/checkout/': {
            react: 'https://cdn.example.com/react-checkout.js',
          },
        },
      });

      expect(resolver.resolve('react', 'https://cdn.example.com/apps/checkout/main.js')).toBe(
        'https://cdn.example.com/react-checkout.js',
      );
    });

    it('falls back to top-level when specifier is not in scope', () => {
      const resolver = createImportMapResolver({
        imports: {
          react: 'https://cdn.example.com/react.js',
          'react-dom': 'https://cdn.example.com/react-dom.js',
        },
        scopes: {
          'https://cdn.example.com/legacy/': {
            react: 'https://cdn.example.com/react-17.js',
          },
        },
      });

      expect(resolver.resolve('react-dom', 'https://cdn.example.com/legacy/app.js')).toBe(
        'https://cdn.example.com/react-dom.js',
      );
    });
  });

  describe('error messages', () => {
    it('includes referrer info in the error message', () => {
      const resolver = createImportMapResolver({ imports: {} });

      expect(() => resolver.resolve('missing', 'https://cdn.example.com/app.js')).toThrow(
        '(referrer: https://cdn.example.com/app.js)',
      );
    });
  });
});
