import { describe, it, expect, beforeEach } from 'vitest';
import { setOverride, clearOverrides, applyOverrides, hasActiveOverrides } from './overrides.js';
import { installDevtoolsApi } from './console-api.js';
import type { ImportMap } from '@esmap/shared';

/**
 * devtools override와 import map 적용의 통합 테스트.
 * 실제 개발자 워크플로우를 시뮬레이션한다.
 */
describe('devtools 통합 테스트', () => {
  beforeEach(() => {
    localStorage.clear();
    const win = globalThis as Record<string, unknown>;
    delete win.__ESMAP__;
  });

  it('override 설정 → import map 적용 → 해제 전체 워크플로우', () => {
    const productionMap: ImportMap = {
      imports: {
        '@flex/checkout': 'https://cdn.flex.team/checkout-abc123.js',
        '@flex/people': 'https://cdn.flex.team/people-def456.js',
        react: 'https://cdn.flex.team/shared/react.js',
      },
    };

    // 1. override 없는 상태
    expect(hasActiveOverrides()).toBe(false);
    const noOverride = applyOverrides(productionMap);
    expect(noOverride).toBe(productionMap); // 동일 참조

    // 2. 개발자가 로컬 빌드로 checkout을 override
    setOverride('@flex/checkout', 'http://localhost:5173/checkout.js');
    expect(hasActiveOverrides()).toBe(true);

    const overridden = applyOverrides(productionMap);
    expect(overridden.imports['@flex/checkout']).toBe('http://localhost:5173/checkout.js');
    expect(overridden.imports['@flex/people']).toBe('https://cdn.flex.team/people-def456.js');
    expect(overridden.imports.react).toBe('https://cdn.flex.team/shared/react.js');

    // 원본은 변경되지 않음
    expect(productionMap.imports['@flex/checkout']).toBe(
      'https://cdn.flex.team/checkout-abc123.js',
    );

    // 3. 테스트 완료 후 override 해제
    clearOverrides();
    expect(hasActiveOverrides()).toBe(false);
    const afterClear = applyOverrides(productionMap);
    expect(afterClear).toBe(productionMap);
  });

  it('devtools API를 통한 override 관리', () => {
    installDevtoolsApi();
    const win = globalThis as Record<string, unknown>;
    const api = win.__ESMAP__ as {
      override: (s: string, u: string) => void;
      isOverriding: () => boolean;
      clearOverrides: () => void;
    };

    // API를 통한 override
    api.override('@flex/checkout', 'http://localhost:5173/checkout.js');
    expect(api.isOverriding()).toBe(true);

    // import map에 적용
    const map: ImportMap = {
      imports: { '@flex/checkout': 'https://cdn/checkout.js' },
    };
    const result = applyOverrides(map);
    expect(result.imports['@flex/checkout']).toBe('http://localhost:5173/checkout.js');

    // 해제
    api.clearOverrides();
    expect(api.isOverriding()).toBe(false);
  });

  it('페이지 새로고침 시뮬레이션 — localStorage에서 override 복원', () => {
    // "이전 세션"에서 override 설정
    setOverride('@flex/checkout', 'http://localhost:5173/checkout.js');

    // "새 세션" 시작 시 localStorage에서 자동으로 읽어옴
    // (clearOverrides를 호출하지 않았으므로 유지됨)
    expect(hasActiveOverrides()).toBe(true);

    const map: ImportMap = {
      imports: { '@flex/checkout': 'https://cdn/checkout.js' },
    };
    const result = applyOverrides(map);
    expect(result.imports['@flex/checkout']).toBe('http://localhost:5173/checkout.js');
  });
});
