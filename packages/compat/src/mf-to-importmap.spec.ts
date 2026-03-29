import { describe, it, expect } from 'vitest';
import { convertMfToImportMap, convertMfSharedToImports } from './mf-to-importmap.js';

describe('convertMfToImportMap', () => {
  it('remote 앱의 scope를 bare specifier로 매핑한다', () => {
    const result = convertMfToImportMap([{ name: 'flexCheckout', scope: '@flex/checkout' }], {
      cdnBase: 'https://cdn.flex.team',
    });

    expect(result.imports['@flex/checkout']).toBe('https://cdn.flex.team/flex-checkout/index.js');
  });

  it('여러 remote를 한번에 변환한다', () => {
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

  it('expose된 서브모듈의 specifier를 생성한다', () => {
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

  it('CDN base URL 끝의 슬래시를 제거한다', () => {
    const result = convertMfToImportMap([{ name: 'flexCheckout', scope: '@flex/checkout' }], {
      cdnBase: 'https://cdn.flex.team/',
    });

    expect(result.imports['@flex/checkout']).toBe('https://cdn.flex.team/flex-checkout/index.js');
  });

  it('빈 remote 목록은 빈 imports를 반환한다', () => {
    const result = convertMfToImportMap([], { cdnBase: 'https://cdn.flex.team' });
    expect(result.imports).toStrictEqual({});
  });

  it('expose가 없는 remote는 메인 엔트리만 생성한다', () => {
    const result = convertMfToImportMap(
      [{ name: 'flexCheckout', scope: '@flex/checkout', exposes: [] }],
      { cdnBase: 'https://cdn.flex.team' },
    );

    expect(Object.keys(result.imports)).toStrictEqual(['@flex/checkout']);
  });
});

describe('convertMfSharedToImports', () => {
  it('공유 라이브러리의 import map 엔트리를 생성한다', () => {
    const result = convertMfSharedToImports(
      { react: '18.3.1', 'react-dom': '18.3.1' },
      'https://cdn.flex.team',
    );

    expect(result.react).toBe('https://cdn.flex.team/shared/react@18.3.1.js');
    expect(result['react-dom']).toBe('https://cdn.flex.team/shared/react-dom@18.3.1.js');
  });

  it('scoped 패키지 이름을 안전하게 변환한다', () => {
    const result = convertMfSharedToImports(
      { '@flex-packages/router': '3.0.0' },
      'https://cdn.flex.team',
    );

    expect(result['@flex-packages/router']).toBe(
      'https://cdn.flex.team/shared/flex-packages-router@3.0.0.js',
    );
  });

  it('CDN base 끝의 슬래시를 제거한다', () => {
    const result = convertMfSharedToImports({ react: '18.3.1' }, 'https://cdn.flex.team/');

    expect(result.react).toBe('https://cdn.flex.team/shared/react@18.3.1.js');
  });

  it('빈 shared 객체는 빈 결과를 반환한다', () => {
    const result = convertMfSharedToImports({}, 'https://cdn.flex.team');
    expect(result).toStrictEqual({});
  });
});
