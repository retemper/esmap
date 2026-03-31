import { describe, it, expect } from 'vitest';
import {
  createEmptyImportMap,
  mergeImportMaps,
  parseImportMap,
  serializeImportMap,
} from './import-map.js';
import { ImportMapError, ImportMapConflictError } from '../errors.js';

describe('createEmptyImportMap', () => {
  it('returns an import map with an empty imports object', () => {
    const result = createEmptyImportMap();
    expect(result).toStrictEqual({ imports: {} });
  });
});

describe('parseImportMap', () => {
  it('parses a valid import map JSON', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
    });

    const result = parseImportMap(json);

    expect(result).toStrictEqual({
      imports: { react: 'https://cdn.example.com/react.js' },
    });
  });

  it('parses an import map with scopes', () => {
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

  it('parses an import map with integrity', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
      integrity: { 'https://cdn.example.com/react.js': 'sha384-abc123' },
    });

    const result = parseImportMap(json);

    expect(result.integrity).toStrictEqual({
      'https://cdn.example.com/react.js': 'sha384-abc123',
    });
  });

  it('throws ImportMapError when imports is missing', () => {
    expect(() => parseImportMap('{}')).toThrow(ImportMapError);
    expect(() => parseImportMap('{}')).toThrow('"imports" object');
  });

  it('throws ImportMapError when the value is not JSON', () => {
    expect(() => parseImportMap('"string"')).toThrow(ImportMapError);
  });

  it('throws ImportMapError when imports value is not a string', () => {
    const json = JSON.stringify({ imports: { react: 123 } });
    expect(() => parseImportMap(json)).toThrow(ImportMapError);
    expect(() => parseImportMap(json)).toThrow('must be a string');
  });

  it('throws ImportMapError when scopes value is not an object', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
      scopes: 'invalid',
    });
    expect(() => parseImportMap(json)).toThrow(ImportMapError);
  });

  it('throws ImportMapError when integrity value is not an object', () => {
    const json = JSON.stringify({
      imports: { react: 'https://cdn.example.com/react.js' },
      integrity: 'invalid',
    });
    expect(() => parseImportMap(json)).toThrow(ImportMapError);
  });

  it('throws SyntaxError for invalid JSON strings', () => {
    expect(() => parseImportMap('not-json')).toThrow(SyntaxError);
  });
});

describe('mergeImportMaps', () => {
  it('overlay wins on conflict with override strategy', () => {
    const base = { imports: { react: 'https://old.js' } };
    const overlay = { imports: { react: 'https://new.js' } };

    const result = mergeImportMaps(base, overlay, 'override');

    expect(result.imports.react).toBe('https://new.js');
  });

  it('base is preserved on conflict with skip strategy', () => {
    const base = { imports: { react: 'https://old.js' } };
    const overlay = { imports: { react: 'https://new.js' } };

    const result = mergeImportMaps(base, overlay, 'skip');

    expect(result.imports.react).toBe('https://old.js');
  });

  it('throws ImportMapConflictError on conflict with error strategy', () => {
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

  it('merges two maps without conflict', () => {
    const base = { imports: { react: 'https://react.js' } };
    const overlay = { imports: { vue: 'https://vue.js' } };

    const result = mergeImportMaps(base, overlay);

    expect(result.imports).toStrictEqual({
      react: 'https://react.js',
      vue: 'https://vue.js',
    });
  });

  it('merges scopes', () => {
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

  it('resolves conflicts within the same scope with override', () => {
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

  it('preserves base scopes when only base has scopes', () => {
    const base = {
      imports: {},
      scopes: { 'https://cdn/': { lib: 'https://lib.js' } },
    };
    const overlay = { imports: {} };

    const result = mergeImportMaps(base, overlay);

    expect(result.scopes).toStrictEqual({ 'https://cdn/': { lib: 'https://lib.js' } });
  });

  it('defaults to override strategy', () => {
    const base = { imports: { x: 'https://a.js' } };
    const overlay = { imports: { x: 'https://b.js' } };

    const result = mergeImportMaps(base, overlay);

    expect(result.imports.x).toBe('https://b.js');
  });

  it('merges integrity', () => {
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
  it('sorts keys alphabetically', () => {
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

  it('sorts keys inside scopes as well', () => {
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

  it('supports custom indent', () => {
    const importMap = { imports: { react: 'https://react.js' } };

    const result4 = serializeImportMap(importMap, 4);

    expect(result4).toContain('    "react"');
  });

  it('excludes scopes from output when absent', () => {
    const importMap = { imports: { react: 'https://react.js' } };

    const result = serializeImportMap(importMap);

    expect(result).not.toContain('scopes');
  });
});
