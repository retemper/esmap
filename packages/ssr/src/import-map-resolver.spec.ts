import { describe, it, expect } from 'vitest';
import { createImportMapResolver } from './import-map-resolver.js';

describe('createImportMapResolver', () => {
  describe('기본 specifier 해석', () => {
    it('imports 맵에서 정확히 일치하는 specifier를 해석한다', () => {
      const resolver = createImportMapResolver({
        imports: { react: 'https://cdn.example.com/react.js' },
      });

      expect(resolver.resolve('react')).toBe('https://cdn.example.com/react.js');
    });

    it('scoped 패키지 specifier를 해석한다', () => {
      const resolver = createImportMapResolver({
        imports: { '@myorg/checkout': 'https://cdn.example.com/checkout-a1b2.js' },
      });

      expect(resolver.resolve('@myorg/checkout')).toBe('https://cdn.example.com/checkout-a1b2.js');
    });

    it('매핑되지 않은 specifier에 대해 에러를 던진다', () => {
      const resolver = createImportMapResolver({ imports: {} });

      expect(() => resolver.resolve('unknown-module')).toThrow(
        'Cannot resolve specifier "unknown-module"',
      );
    });

    it('절대 URL은 그대로 통과시킨다', () => {
      const resolver = createImportMapResolver({ imports: {} });

      expect(resolver.resolve('https://cdn.example.com/mod.js')).toBe(
        'https://cdn.example.com/mod.js',
      );
    });
  });

  describe('패키지 경로 접두사 매칭 (trailing slash)', () => {
    it('trailing slash 접두사를 사용하여 하위 경로를 해석한다', () => {
      const resolver = createImportMapResolver({
        imports: { 'lodash/': 'https://cdn.example.com/lodash/' },
      });

      expect(resolver.resolve('lodash/debounce')).toBe('https://cdn.example.com/lodash/debounce');
    });

    it('가장 긴 접두사를 우선 매칭한다', () => {
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

  describe('scope 기반 해석', () => {
    it('referrer URL에 매칭되는 scope의 매핑을 우선 사용한다', () => {
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

    it('scope에 매칭되지 않으면 top-level imports를 사용한다', () => {
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

    it('가장 긴 scope 접두사를 우선 매칭한다', () => {
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

    it('scope에 specifier가 없으면 top-level로 폴백한다', () => {
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

  describe('에러 메시지', () => {
    it('referrer 정보가 에러 메시지에 포함된다', () => {
      const resolver = createImportMapResolver({ imports: {} });

      expect(() => resolver.resolve('missing', 'https://cdn.example.com/app.js')).toThrow(
        '(referrer: https://cdn.example.com/app.js)',
      );
    });
  });
});
