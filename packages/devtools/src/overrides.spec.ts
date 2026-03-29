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
    it('localStorage가 비어있으면 빈 배열을 반환한다', () => {
      expect(getOverrides()).toStrictEqual([]);
    });

    it('저장된 override를 반환한다', () => {
      localStorage.setItem(
        'esmap:overrides',
        JSON.stringify([{ specifier: 'react', url: 'http://localhost:3000/react.js' }]),
      );

      const result = getOverrides();
      expect(result).toStrictEqual([{ specifier: 'react', url: 'http://localhost:3000/react.js' }]);
    });

    it('잘못된 JSON이면 빈 배열을 반환한다', () => {
      localStorage.setItem('esmap:overrides', 'not-json');
      expect(getOverrides()).toStrictEqual([]);
    });

    it('배열이 아닌 값이면 빈 배열을 반환한다', () => {
      localStorage.setItem('esmap:overrides', '"string"');
      expect(getOverrides()).toStrictEqual([]);
    });

    it('유효하지 않은 엔트리를 필터링한다', () => {
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
    it('새 override를 추가한다', () => {
      setOverride('react', 'http://localhost:3000/react.js');

      const result = getOverrides();
      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        specifier: 'react',
        url: 'http://localhost:3000/react.js',
      });
    });

    it('동일 specifier가 있으면 URL을 갱신한다', () => {
      setOverride('react', 'http://localhost:3000/react-old.js');
      setOverride('react', 'http://localhost:3000/react-new.js');

      const result = getOverrides();
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('http://localhost:3000/react-new.js');
    });

    it('여러 specifier를 독립적으로 관리한다', () => {
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      const result = getOverrides();
      expect(result).toHaveLength(2);
    });
  });

  describe('removeOverride', () => {
    it('특정 specifier의 override를 제거한다', () => {
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      removeOverride('react');

      const result = getOverrides();
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('vue');
    });

    it('존재하지 않는 specifier를 제거해도 에러가 없다', () => {
      setOverride('react', 'http://localhost/react.js');
      removeOverride('vue');

      expect(getOverrides()).toHaveLength(1);
    });
  });

  describe('clearOverrides', () => {
    it('모든 override를 제거한다', () => {
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      clearOverrides();

      expect(getOverrides()).toStrictEqual([]);
    });
  });

  describe('applyOverrides', () => {
    it('override가 없으면 원본을 그대로 반환한다', () => {
      const importMap: ImportMap = {
        imports: { react: 'https://cdn.example.com/react.js' },
      };

      const result = applyOverrides(importMap);
      expect(result).toBe(importMap);
    });

    it('override가 있는 specifier의 URL을 대체한다', () => {
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

    it('import map에 없는 specifier의 override는 무시한다', () => {
      setOverride('angular', 'http://localhost/angular.js');

      const importMap: ImportMap = {
        imports: { react: 'https://cdn.example.com/react.js' },
      };

      const result = applyOverrides(importMap);
      expect(result.imports).toStrictEqual({ react: 'https://cdn.example.com/react.js' });
    });

    it('원본 import map을 변경하지 않는다', () => {
      setOverride('react', 'http://localhost:3000/react.js');

      const importMap: ImportMap = {
        imports: { react: 'https://cdn.example.com/react.js' },
      };

      applyOverrides(importMap);

      expect(importMap.imports.react).toBe('https://cdn.example.com/react.js');
    });

    it('scopes와 integrity를 보존한다', () => {
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
    it('override가 없으면 false를 반환한다', () => {
      expect(hasActiveOverrides()).toBe(false);
    });

    it('override가 있으면 true를 반환한다', () => {
      setOverride('react', 'http://localhost/react.js');
      expect(hasActiveOverrides()).toBe(true);
    });

    it('모두 제거한 후 false를 반환한다', () => {
      setOverride('react', 'http://localhost/react.js');
      clearOverrides();
      expect(hasActiveOverrides()).toBe(false);
    });
  });
});
