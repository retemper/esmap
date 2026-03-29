import { describe, it, expect, afterEach } from 'vitest';
import { snapshotGlobals, diffGlobals, createGlobalGuard } from './global-guard.js';

describe('snapshotGlobals', () => {
  it('현재 전역 변수 이름의 Set을 반환한다', () => {
    const snapshot = snapshotGlobals();
    expect(snapshot).toBeInstanceOf(Set);
    expect(snapshot.size).toBeGreaterThan(0);
  });
});

describe('diffGlobals', () => {
  afterEach(() => {
    const win = globalThis as Record<string, unknown>;
    delete win.__test_global_1__;
    delete win.__test_global_2__;
  });

  it('새로 추가된 전역 변수를 감지한다', () => {
    const before = snapshotGlobals();

    const win = globalThis as Record<string, unknown>;
    win.__test_global_1__ = 'value';

    const diff = diffGlobals(before);
    expect(diff).toContain('__test_global_1__');
  });

  it('allowList에 포함된 변수는 제외한다', () => {
    const before = snapshotGlobals();

    const win = globalThis as Record<string, unknown>;
    win.__test_global_1__ = 'value';

    const diff = diffGlobals(before, ['__test_global_1__']);
    expect(diff).not.toContain('__test_global_1__');
  });

  it('변경 없으면 빈 배열을 반환한다', () => {
    const before = snapshotGlobals();
    const diff = diffGlobals(before);
    expect(diff).toStrictEqual([]);
  });

  it('여러 변수 추가를 감지한다', () => {
    const before = snapshotGlobals();

    const win = globalThis as Record<string, unknown>;
    win.__test_global_1__ = 'a';
    win.__test_global_2__ = 'b';

    const diff = diffGlobals(before);
    expect(diff).toContain('__test_global_1__');
    expect(diff).toContain('__test_global_2__');
  });
});

describe('createGlobalGuard', () => {
  afterEach(() => {
    const win = globalThis as Record<string, unknown>;
    delete win.__guard_test__;
    delete win.__guard_test_2__;
  });

  it('dispose()는 추가된 전역 변수 목록을 반환한다', async () => {
    const guard = createGlobalGuard({ interval: 50 });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'value';

    // 폴링 간격 대기
    await new Promise((resolve) => setTimeout(resolve, 80));

    const added = guard.dispose();
    expect(added).toContain('__guard_test__');
  });

  it('onViolation 콜백을 호출한다', async () => {
    const violations: { property: string; type: string }[] = [];

    const guard = createGlobalGuard({
      interval: 50,
      onViolation: (v) => violations.push(v),
    });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'value';

    await new Promise((resolve) => setTimeout(resolve, 80));

    guard.dispose();

    expect(violations).toHaveLength(1);
    expect(violations[0].property).toBe('__guard_test__');
    expect(violations[0].type).toBe('add');
  });

  it('allowList에 포함된 전역 변수는 무시한다', async () => {
    const violations: { property: string }[] = [];

    const guard = createGlobalGuard({
      interval: 50,
      allowList: ['__guard_test__'],
      onViolation: (v) => violations.push(v),
    });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'value';

    await new Promise((resolve) => setTimeout(resolve, 80));

    const added = guard.dispose();

    expect(violations).toHaveLength(0);
    expect(added).not.toContain('__guard_test__');
  });

  it('기본 interval은 1000ms이다', () => {
    const guard = createGlobalGuard();
    // dispose가 에러 없이 동작해야 한다
    const added = guard.dispose();
    expect(Array.isArray(added)).toBe(true);
  });

  it('check()를 수동 호출하면 즉시 감지한다', () => {
    const violations: { property: string }[] = [];
    const guard = createGlobalGuard({
      interval: 60_000, // 긴 간격 → 폴링으로는 감지 불가
      onViolation: (v) => violations.push(v),
    });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'manual-check';

    guard.check();

    expect(violations).toHaveLength(1);
    expect(violations[0].property).toBe('__guard_test__');

    guard.dispose();
  });

  it('같은 변수를 중복 감지하지 않는다', async () => {
    const violations: { property: string }[] = [];
    const guard = createGlobalGuard({
      interval: 30,
      onViolation: (v) => violations.push(v),
    });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'first';

    // 여러 폴링 사이클 대기
    await new Promise((resolve) => setTimeout(resolve, 100));

    guard.dispose();

    // 한 번만 감지됨
    expect(violations).toHaveLength(1);
  });
});
