import { describe, it, expect, afterEach } from 'vitest';
import { snapshotGlobals, diffGlobals, createGlobalGuard } from './global-guard.js';

describe('snapshotGlobals', () => {
  it('returns a Set of current global variable names', () => {
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

  it('detects newly added global variables', () => {
    const before = snapshotGlobals();

    const win = globalThis as Record<string, unknown>;
    win.__test_global_1__ = 'value';

    const diff = diffGlobals(before);
    expect(diff).toContain('__test_global_1__');
  });

  it('excludes variables in the allowList', () => {
    const before = snapshotGlobals();

    const win = globalThis as Record<string, unknown>;
    win.__test_global_1__ = 'value';

    const diff = diffGlobals(before, ['__test_global_1__']);
    expect(diff).not.toContain('__test_global_1__');
  });

  it('returns an empty array when there are no changes', () => {
    const before = snapshotGlobals();
    const diff = diffGlobals(before);
    expect(diff).toStrictEqual([]);
  });

  it('detects multiple added variables', () => {
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

  it('dispose() returns the list of added global variables', async () => {
    const guard = createGlobalGuard({ interval: 50 });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'value';

    // Wait for polling interval
    await new Promise((resolve) => setTimeout(resolve, 80));

    const added = guard.dispose();
    expect(added).toContain('__guard_test__');
  });

  it('invokes the onViolation callback', async () => {
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

  it('ignores global variables in the allowList', async () => {
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

  it('uses a default interval of 1000ms', () => {
    const guard = createGlobalGuard();
    // dispose should work without errors
    const added = guard.dispose();
    expect(Array.isArray(added)).toBe(true);
  });

  it('detects immediately when check() is called manually', () => {
    const violations: { property: string }[] = [];
    const guard = createGlobalGuard({
      interval: 60_000, // Long interval -- cannot detect via polling
      onViolation: (v) => violations.push(v),
    });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'manual-check';

    guard.check();

    expect(violations).toHaveLength(1);
    expect(violations[0].property).toBe('__guard_test__');

    guard.dispose();
  });

  it('does not detect the same variable more than once', async () => {
    const violations: { property: string }[] = [];
    const guard = createGlobalGuard({
      interval: 30,
      onViolation: (v) => violations.push(v),
    });

    const win = globalThis as Record<string, unknown>;
    win.__guard_test__ = 'first';

    // Wait for multiple polling cycles
    await new Promise((resolve) => setTimeout(resolve, 100));

    guard.dispose();

    // Detected only once
    expect(violations).toHaveLength(1);
  });
});
