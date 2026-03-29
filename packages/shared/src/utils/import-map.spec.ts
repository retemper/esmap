import { describe, it, expect } from 'vitest';
import {
  createEmptyImportMap,
  mergeImportMaps,
  parseImportMap,
  serializeImportMap,
} from './import-map.js';
import { ImportMapError, ImportMapConflictError } from '../errors.js';

describe('createEmptyImportMap', () => {
  it('빈 imports 객체를 가진 import map을 반환한다', () => {
    const result = createEmptyImportMap();
    expect(result).toStrictEqual({ imports: {} });
  });
});

describe('parseImportMap', () => {
  it('유효한 import map JSON을 파싱한다', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
    });

    const result = parseImportMap(json);

    expect(result).toStrictEqual({
      imports: { react: 'https://cdn.example.com/react.js' },
    });
  });

  it('scopes가 포함된 import map을 파싱한다', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react@18.js' },
      scopes: {
        'https://cdn.example.com/apps/people/': {
          react: 'https://cdn.example.com/react@19.js',
        },
      },
    });

    const result = parseImportMap(json);

    expect(result.scopes).toStrictEqual({
      'https://cdn.example.com/apps/people/': {
        react: 'https://cdn.example.com/react@19.js',
      },
    });
  });

  it('integrity가 포함된 import map을 파싱한다', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
      integrity: { 'https://cdn.example.com/react.js': 'sha384-abc123' },
    });

    const result = parseImportMap(json);

    expect(result.integrity).toStrictEqual({
      'https://cdn.example.com/react.js': 'sha384-abc123',
    });
  });

  it('imports가 없으면 ImportMapError를 던진다', () => {
    expect(() => parseImportMap('{}')).toThrow(ImportMapError);
    expect(() => parseImportMap('{}')).toThrow('"imports" object');
  });

  it('JSON이 아닌 값이면 ImportMapError를 던진다', () => {
    expect(() => parseImportMap('"string"')).toThrow(ImportMapError);
  });

  it('imports 값이 string이 아니면 ImportMapError를 던진다', () => {
    const json = JSON.stringify({ imports: { react: 123 } });
    expect(() => parseImportMap(json)).toThrow(ImportMapError);
    expect(() => parseImportMap(json)).toThrow('must be a string');
  });

  it('scopes 값이 객체가 아니면 ImportMapError를 던진다', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
      scopes: 'invalid',
    });
    expect(() => parseImportMap(json)).toThrow(ImportMapError);
  });

  it('integrity 값이 객체가 아니면 ImportMapError를 던진다', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
      integrity: 'invalid',
    });
    expect(() => parseImportMap(json)).toThrow(ImportMapError);
  });

  it('잘못된 JSON 문자열이면 SyntaxError를 던진다', () => {
    expect(() => parseImportMap('not-json')).toThrow(SyntaxError);
  });
});

describe('mergeImportMaps', () => {
  it('override 전략으로 충돌 시 overlay가 이긴다', () => {
    const base = { imports: { react: 'https://old.js' } };
    const overlay = { imports: { react: 'https://new.js' } };

    const result = mergeImportMaps(base, overlay, 'override');

    expect(result.imports.react).toBe('https://new.js');
  });

  it('skip 전략으로 충돌 시 base가 유지된다', () => {
    const base = { imports: { react: 'https://old.js' } };
    const overlay = { imports: { react: 'https://new.js' } };

    const result = mergeImportMaps(base, overlay, 'skip');

    expect(result.imports.react).toBe('https://old.js');
  });

  it('error 전략으로 충돌 시 ImportMapConflictError를 던진다', () => {
    const base = { imports: { react: 'https://old.js' } };
    const overlay = { imports: { react: 'https://new.js' } };

    expect(() => mergeImportMaps(base, overlay, 'error')).toThrow(ImportMapConflictError);
    try {
      mergeImportMaps(base, overlay, 'error');
    } catch (e) {
      expect(e).toBeInstanceOf(ImportMapConflictError);
      expect((e as ImportMapConflictError).specifier).toBe('react');
      expect((e as ImportMapConflictError).code).toBe('IMPORT_MAP_CONFLICT');
    }
  });

  it('충돌 없이 두 map을 합친다', () => {
    const base = { imports: { react: 'https://react.js' } };
    const overlay = { imports: { vue: 'https://vue.js' } };

    const result = mergeImportMaps(base, overlay);

    expect(result.imports).toStrictEqual({
      react: 'https://react.js',
      vue: 'https://vue.js',
    });
  });

  it('scopes를 병합한다', () => {
    const base = {
      imports: {},
      scopes: {
        'https://cdn/app-a/': { react: 'https://react@18.js' },
      },
    };
    const overlay = {
      imports: {},
      scopes: {
        'https://cdn/app-b/': { react: 'https://react@19.js' },
      },
    };

    const result = mergeImportMaps(base, overlay);

    expect(result.scopes).toStrictEqual({
      'https://cdn/app-a/': { react: 'https://react@18.js' },
      'https://cdn/app-b/': { react: 'https://react@19.js' },
    });
  });

  it('동일 scope 내 충돌을 override로 해결한다', () => {
    const base = {
      imports: {},
      scopes: {
        'https://cdn/app-a/': { react: 'https://react@18.js' },
      },
    };
    const overlay = {
      imports: {},
      scopes: {
        'https://cdn/app-a/': { react: 'https://react@19.js' },
      },
    };

    const result = mergeImportMaps(base, overlay, 'override');

    expect(result.scopes?.['https://cdn/app-a/'].react).toBe('https://react@19.js');
  });

  it('base만 scopes가 있을 때 base scopes를 유지한다', () => {
    const base = {
      imports: {},
      scopes: { 'https://cdn/': { lib: 'https://lib.js' } },
    };
    const overlay = { imports: {} };

    const result = mergeImportMaps(base, overlay);

    expect(result.scopes).toStrictEqual({ 'https://cdn/': { lib: 'https://lib.js' } });
  });

  it('기본 전략은 override다', () => {
    const base = { imports: { x: 'https://a.js' } };
    const overlay = { imports: { x: 'https://b.js' } };

    const result = mergeImportMaps(base, overlay);

    expect(result.imports.x).toBe('https://b.js');
  });

  it('integrity를 병합한다', () => {
    const base = {
      imports: {},
      integrity: { 'https://a.js': 'sha384-aaa' },
    };
    const overlay = {
      imports: {},
      integrity: { 'https://b.js': 'sha384-bbb' },
    };

    const result = mergeImportMaps(base, overlay);

    expect(result.integrity).toStrictEqual({
      'https://a.js': 'sha384-aaa',
      'https://b.js': 'sha384-bbb',
    });
  });
});

describe('serializeImportMap', () => {
  it('키를 알파벳 순으로 정렬한다', () => {
    const importMap = {
      imports: {
        vue: 'https://vue.js',
        react: 'https://react.js',
        angular: 'https://angular.js',
      },
    };

    const result = serializeImportMap(importMap);
    const parsed = JSON.parse(result);
    const keys = Object.keys(parsed.imports);

    expect(keys).toStrictEqual(['angular', 'react', 'vue']);
  });

  it('scopes 내부 키도 정렬한다', () => {
    const importMap = {
      imports: {},
      scopes: {
        'https://cdn/app-b/': { z: 'https://z.js', a: 'https://a.js' },
        'https://cdn/app-a/': { b: 'https://b.js' },
      },
    };

    const result = serializeImportMap(importMap);
    const parsed = JSON.parse(result);
    const scopeKeys = Object.keys(parsed.scopes);
    const innerKeys = Object.keys(parsed.scopes['https://cdn/app-b/']);

    expect(scopeKeys).toStrictEqual(['https://cdn/app-a/', 'https://cdn/app-b/']);
    expect(innerKeys).toStrictEqual(['a', 'z']);
  });

  it('indent를 지정할 수 있다', () => {
    const importMap = { imports: { react: 'https://react.js' } };

    const result4 = serializeImportMap(importMap, 4);

    expect(result4).toContain('    "react"');
  });

  it('scopes가 없으면 출력에 포함하지 않는다', () => {
    const importMap = { imports: { react: 'https://react.js' } };

    const result = serializeImportMap(importMap);

    expect(result).not.toContain('scopes');
  });
});
