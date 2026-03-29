import { describe, it, expect } from 'vitest';
import { analyzeDependencyConflicts } from './analyze-deps.js';
import type { AppDependencyDeclaration } from './analyze-deps.js';

/**
 * 테스트 헬퍼: 앱 의존성 선언을 간편하게 생성한다.
 * @param appName - 앱 이름
 * @param deps - 의존성 이름-버전 쌍의 레코드
 */
function createDeclaration(
  appName: string,
  deps: Record<string, string>,
): AppDependencyDeclaration {
  return {
    appName,
    dependencies: new Map(Object.entries(deps)),
  };
}

describe('analyzeDependencyConflicts', () => {
  it('호환되는 범위들은 충돌 없이 통과한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '^18.0.0' }),
      createDeclaration('app-b', { react: '^18.2.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
  });

  it('다른 메이저 버전은 에러 충돌로 감지한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '^17.0.0' }),
      createDeclaration('app-b', { react: '^18.0.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].dependencyName).toBe('react');
    expect(result.conflicts[0].severity).toBe('error');
    expect(result.conflicts[0].apps.length).toBe(2);
  });

  it('동일 메이저 다른 마이너 버전의 ^범위는 호환으로 판단한다', () => {
    const declarations = [
      createDeclaration('app-a', { lodash: '^4.17.0' }),
      createDeclaration('app-b', { lodash: '^4.10.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
  });

  it('겹치지 않는 ~범위는 충돌로 감지한다', () => {
    const declarations = [
      createDeclaration('app-a', { lodash: '~4.17.0' }),
      createDeclaration('app-b', { lodash: '~4.16.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].dependencyName).toBe('lodash');
    expect(result.conflicts[0].severity).toBe('error');
  });

  it('단일 앱의 의존성은 충돌 없이 통과한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '^18.0.0', lodash: '^4.17.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
  });

  it('빈 선언 목록은 에러 없이 통과한다', () => {
    const result = analyzeDependencyConflicts([]);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
    expect(result.summary).toBe('No dependency conflicts detected.');
  });

  it('summary가 충돌 개수를 포함한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '^17.0.0', vue: '^2.0.0' }),
      createDeclaration('app-b', { react: '^18.0.0', vue: '^3.0.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.summary).toContain('2 error(s)');
    expect(result.summary).toContain('0 warning(s)');
  });

  it('3개 이상 앱의 다자간 충돌을 감지한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '^17.0.0' }),
      createDeclaration('app-b', { react: '^18.0.0' }),
      createDeclaration('app-c', { react: '^19.0.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].apps.length).toBe(3);
    expect(result.conflicts[0].severity).toBe('error');
  });

  it('정확 일치 버전이 다르면 에러 충돌로 감지한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '18.2.0' }),
      createDeclaration('app-b', { react: '18.3.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].severity).toBe('error');
  });

  it('정확 일치 버전이 같으면 충돌 없이 통과한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '18.2.0' }),
      createDeclaration('app-b', { react: '18.2.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
  });

  it('정확 일치 버전이 ^범위를 만족하면 호환으로 판단한다', () => {
    const declarations = [
      createDeclaration('app-a', { react: '18.2.0' }),
      createDeclaration('app-b', { react: '^18.0.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
  });
});
