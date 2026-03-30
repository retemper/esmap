import { describe, it, expect } from 'vitest';
import { isRecord } from './type-guards.js';

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord({ nested: { deep: true } })).toBe(true);
  });

  it('returns true for objects created with Object.create(null)', () => {
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it('returns false for null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it('returns false for primitive types', () => {
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(Symbol('test'))).toBe(false);
    expect(isRecord(BigInt(0))).toBe(false);
  });

  it('returns false for Arrays', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it('returns false for non-plain objects like Date, RegExp, etc.', () => {
    expect(isRecord(new Date())).toBe(false);
    expect(isRecord(/regex/)).toBe(false);
    expect(isRecord(new Map())).toBe(false);
    expect(isRecord(new Set())).toBe(false);
    expect(isRecord(new Error('test'))).toBe(false);
  });

  it('returns false for functions', () => {
    expect(isRecord(() => {})).toBe(false);
  });
});
