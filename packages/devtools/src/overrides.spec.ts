import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOverrides,
  setOverride,
  removeOverride,
  clearOverrides,
  applyOverrides,
  hasActiveOverrides,
} from './overrides.js';
import type { ImportMap } from '@esmap/shared';

describe('overrides', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getOverrides', () => {
    it('returns an empty array when localStorage is empty', () => {
      expect(getOverrides()).toStrictEqual([]);
    });

    it('returns stored overrides', () => {
      localStorage.setItem(
        'esmap:overrides',
        JSON.stringify([{ specifier: 'react', url: 'http://localhost:3000/react.js' }]),
      );

      const result = getOverrides();
      expect(result).toStrictEqual([{ specifier: 'react', url: 'http://localhost:3000/react.js' }]);
    });

    it('returns an empty array for invalid JSON', () => {
      localStorage.setItem('esmap:overrides', 'not-json');
      expect(getOverrides()).toStrictEqual([]);
    });

    it('returns an empty array for non-array values', () => {
      localStorage.setItem('esmap:overrides', '"string"');
      expect(getOverrides()).toStrictEqual([]);
    });

    it('filters out invalid entries', () => {
      localStorage.setItem(
        'esmap:overrides',
        JSON.stringify([
          { specifier: 'react', url: 'http://localhost/react.js' },
          { specifier: 123, url: 'bad' },
          null,
          { specifier: 'vue' },
        ]),
      );

      const result = getOverrides();
      expect(result).toStrictEqual([{ specifier: 'react', url: 'http://localhost/react.js' }]);
    });
  });

  describe('setOverride', () => {
    it('adds a new override', () => {
      setOverride('react', 'http://localhost:3000/react.js');

      const result = getOverrides();
      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        specifier: 'react',
        url: 'http://localhost:3000/react.js',
      });
    });

    it('updates the URL when the same specifier already exists', () => {
      setOverride('react', 'http://localhost:3000/react-old.js');
      setOverride('react', 'http://localhost:3000/react-new.js');

      const result = getOverrides();
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('http://localhost:3000/react-new.js');
    });

    it('manages multiple specifiers independently', () => {
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      const result = getOverrides();
      expect(result).toHaveLength(2);
    });
  });

  describe('removeOverride', () => {
    it('removes the override for a specific specifier', () => {
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      removeOverride('react');

      const result = getOverrides();
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('vue');
    });

    it('does not throw when removing a nonexistent specifier', () => {
      setOverride('react', 'http://localhost/react.js');
      removeOverride('vue');

      expect(getOverrides()).toHaveLength(1);
    });
  });

  describe('clearOverrides', () => {
    it('removes all overrides', () => {
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      clearOverrides();

      expect(getOverrides()).toStrictEqual([]);
    });
  });

  describe('applyOverrides', () => {
    it('returns the original when there are no overrides', () => {
      const importMap: ImportMap = {
        imports: { react: 'https://cdn.example.com/react.js' },
      };

      const result = applyOverrides(importMap);
      expect(result).toBe(importMap);
    });

    it('replaces the URL for overridden specifiers', () => {
      setOverride('react', 'http://localhost:3000/react.js');

      const importMap: ImportMap = {
        imports: {
          react: 'https://cdn.example.com/react.js',
          vue: 'https://cdn.example.com/vue.js',
        },
      };

      const result = applyOverrides(importMap);

      expect(result.imports.react).toBe('http://localhost:3000/react.js');
      expect(result.imports.vue).toBe('https://cdn.example.com/vue.js');
    });

    it('ignores overrides for specifiers not in the import map', () => {
      setOverride('angular', 'http://localhost/angular.js');

      const importMap: ImportMap = {
        imports: { react: 'https://cdn.example.com/react.js' },
      };

      const result = applyOverrides(importMap);
      expect(result.imports).toStrictEqual({ react: 'https://cdn.example.com/react.js' });
    });

    it('does not modify the original import map', () => {
      setOverride('react', 'http://localhost:3000/react.js');

      const importMap: ImportMap = {
        imports: { react: 'https://cdn.example.com/react.js' },
      };

      applyOverrides(importMap);

      expect(importMap.imports.react).toBe('https://cdn.example.com/react.js');
    });

    it('preserves scopes and integrity', () => {
      setOverride('react', 'http://localhost/react.js');

      const importMap: ImportMap = {
        imports: { react: 'https://cdn/react.js' },
        scopes: { 'https://cdn/app/': { lib: 'https://cdn/lib.js' } },
        integrity: { 'https://cdn/react.js': 'sha384-abc' },
      };

      const result = applyOverrides(importMap);

      expect(result.scopes).toStrictEqual(importMap.scopes);
      expect(result.integrity).toStrictEqual(importMap.integrity);
    });
  });

  describe('hasActiveOverrides', () => {
    it('returns false when there are no overrides', () => {
      expect(hasActiveOverrides()).toBe(false);
    });

    it('returns true when overrides exist', () => {
      setOverride('react', 'http://localhost/react.js');
      expect(hasActiveOverrides()).toBe(true);
    });

    it('returns false after removing all overrides', () => {
      setOverride('react', 'http://localhost/react.js');
      clearOverrides();
      expect(hasActiveOverrides()).toBe(false);
    });
  });
});
