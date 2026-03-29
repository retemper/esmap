import { describe, it, expect } from 'vitest';
import { isRecord } from './type-guards.js';

describe('isRecord', () => {
  it('plain object를 true로 판별한다', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord({ nested: { deep: true } })).toBe(true);
  });

  it('Object.create(null)로 만든 객체를 true로 판별한다', () => {
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it('null을 false로 판별한다', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('undefined를 false로 판별한다', () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it('원시 타입을 false로 판별한다', () => {
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(Symbol('test'))).toBe(false);
    expect(isRecord(BigInt(0))).toBe(false);
  });

  it('Array를 false로 판별한다', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it('Date, RegExp 등 non-plain object를 false로 판별한다', () => {
    expect(isRecord(new Date())).toBe(false);
    expect(isRecord(/regex/)).toBe(false);
    expect(isRecord(new Map())).toBe(false);
    expect(isRecord(new Set())).toBe(false);
    expect(isRecord(new Error('test'))).toBe(false);
  });

  it('함수를 false로 판별한다', () => {
    expect(isRecord(() => {})).toBe(false);
  });
});
