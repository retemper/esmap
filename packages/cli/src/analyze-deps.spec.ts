import { describe, it, expect } from 'vitest';
import { analyzeDependencyConflicts } from './analyze-deps.js';
import type { AppDependencyDeclaration } from './analyze-deps.js';

/**
 * Test helper: conveniently creates an app dependency declaration.
 * @param appName - app name
 * @param deps - record of dependency name-version pairs
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
  it('compatible ranges pass without conflicts', () => {
    const declarations = [
      createDeclaration('app-a', { react: '^18.0.0' }),
      createDeclaration('app-b', { react: '^18.2.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
  });

  it('detects different major versions as error conflicts', () => {
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

  it('treats ^ ranges with same major but different minor versions as compatible', () => {
    const declarations = [
      createDeclaration('app-a', { lodash: '^4.17.0' }),
      createDeclaration('app-b', { lodash: '^4.10.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
  });

  it('detects non-overlapping ~ ranges as conflicts', () => {
    const declarations = [
      createDeclaration('app-a', { lodash: '~4.17.0' }),
      createDeclaration('app-b', { lodash: '~4.16.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].dependencyName).toBe('lodash');
    expect(result.conflicts[0].severity).toBe('error');
  });

  it('dependencies from a single app pass without conflicts', () => {
    const declarations = [createDeclaration('app-a', { react: '^18.0.0', lodash: '^4.17.0' })];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
  });

  it('an empty declaration list passes without errors', () => {
    const result = analyzeDependencyConflicts([]);

    expect(result.conflicts).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
    expect(result.summary).toBe('No dependency conflicts detected.');
  });

  it('summary includes the number of conflicts', () => {
    const declarations = [
      createDeclaration('app-a', { react: '^17.0.0', vue: '^2.0.0' }),
      createDeclaration('app-b', { react: '^18.0.0', vue: '^3.0.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.summary).toContain('2 error(s)');
    expect(result.summary).toContain('0 warning(s)');
  });

  it('detects multi-party conflicts across three or more apps', () => {
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

  it('detects different exact versions as error conflicts', () => {
    const declarations = [
      createDeclaration('app-a', { react: '18.2.0' }),
      createDeclaration('app-b', { react: '18.3.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].severity).toBe('error');
  });

  it('identical exact versions pass without conflicts', () => {
    const declarations = [
      createDeclaration('app-a', { react: '18.2.0' }),
      createDeclaration('app-b', { react: '18.2.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
  });

  it('treats an exact version satisfying a ^ range as compatible', () => {
    const declarations = [
      createDeclaration('app-a', { react: '18.2.0' }),
      createDeclaration('app-b', { react: '^18.0.0' }),
    ];

    const result = analyzeDependencyConflicts(declarations);

    expect(result.conflicts).toStrictEqual([]);
  });
});
