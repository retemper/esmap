import { describe, it, expect } from 'vitest';
import { convertMfToImportMap, convertMfSharedToImports } from './mf-to-importmap.js';

describe('convertMfToImportMap', () => {
  it('maps remote app scopes to bare specifiers', () => {
    const result = convertMfToImportMap([{ name: 'flexCheckout', scope: '@flex/checkout' }], {
      cdnBase: 'https://cdn.flex.team',
    });

    expect(result.imports['@flex/checkout']).toBe('https://cdn.flex.team/flex-checkout/index.js');
  });

  it('converts multiple remotes at once', () => {
    const result = convertMfToImportMap(
      [
        { name: 'flexCheckout', scope: '@flex/checkout' },
        { name: 'flexPeople', scope: '@flex/people' },
      ],
      { cdnBase: 'https://cdn.flex.team' },
    );

    expect(Object.keys(result.imports)).toHaveLength(2);
    expect(result.imports['@flex/checkout']).toBeDefined();
    expect(result.imports['@flex/people']).toBeDefined();
  });

  it('generates specifiers for exposed submodules', () => {
    const result = convertMfToImportMap(
      [
        {
          name: 'flexCheckout',
          scope: '@flex/checkout',
          exposes: [
            { key: './Button', path: './src/components/Button.tsx' },
            { key: './utils', path: './src/utils/index.ts' },
          ],
        },
      ],
      { cdnBase: 'https://cdn.flex.team' },
    );

    expect(result.imports['@flex/checkout/Button']).toBe(
      'https://cdn.flex.team/flex-checkout/Button.js',
    );
    expect(result.imports['@flex/checkout/utils']).toBe(
      'https://cdn.flex.team/flex-checkout/utils.js',
    );
  });

  it('strips trailing slash from CDN base URL', () => {
    const result = convertMfToImportMap([{ name: 'flexCheckout', scope: '@flex/checkout' }], {
      cdnBase: 'https://cdn.flex.team/',
    });

    expect(result.imports['@flex/checkout']).toBe('https://cdn.flex.team/flex-checkout/index.js');
  });

  it('returns empty imports for an empty remote list', () => {
    const result = convertMfToImportMap([], { cdnBase: 'https://cdn.flex.team' });
    expect(result.imports).toStrictEqual({});
  });

  it('generates only the main entry for a remote with no exposes', () => {
    const result = convertMfToImportMap(
      [{ name: 'flexCheckout', scope: '@flex/checkout', exposes: [] }],
      { cdnBase: 'https://cdn.flex.team' },
    );

    expect(Object.keys(result.imports)).toStrictEqual(['@flex/checkout']);
  });
});

describe('convertMfSharedToImports', () => {
  it('generates import map entries for shared libraries', () => {
    const result = convertMfSharedToImports(
      { react: '18.3.1', 'react-dom': '18.3.1' },
      'https://cdn.flex.team',
    );

    expect(result.react).toBe('https://cdn.flex.team/shared/react@18.3.1.js');
    expect(result['react-dom']).toBe('https://cdn.flex.team/shared/react-dom@18.3.1.js');
  });

  it('safely converts scoped package names', () => {
    const result = convertMfSharedToImports(
      { '@flex-packages/router': '3.0.0' },
      'https://cdn.flex.team',
    );

    expect(result['@flex-packages/router']).toBe(
      'https://cdn.flex.team/shared/flex-packages-router@3.0.0.js',
    );
  });

  it('strips trailing slash from CDN base', () => {
    const result = convertMfSharedToImports({ react: '18.3.1' }, 'https://cdn.flex.team/');

    expect(result.react).toBe('https://cdn.flex.team/shared/react@18.3.1.js');
  });

  it('returns an empty result for an empty shared object', () => {
    const result = convertMfSharedToImports({}, 'https://cdn.flex.team');
    expect(result).toStrictEqual({});
  });
});
