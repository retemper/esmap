import { parseSemver, satisfiesRange } from '@esmap/runtime';
import type { SemverParts } from '@esmap/runtime';

/** 앱별 의존성 선언 */
export interface AppDependencyDeclaration {
  readonly appName: string;
  readonly dependencies: ReadonlyMap<string, string>;
}

/** 의존성 충돌에 관여하는 앱 정보 */
interface ConflictApp {
  readonly appName: string;
  readonly versionRange: string;
}

/** 의존성 충돌 정보 */
export interface DependencyConflict {
  readonly dependencyName: string;
  readonly apps: readonly ConflictApp[];
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

/** 분석 결과 */
export interface DependencyAnalysisResult {
  readonly conflicts: readonly DependencyConflict[];
  readonly warnings: readonly DependencyConflict[];
  readonly summary: string;
}

/** 범위 문자열에서 연산자와 버전 부분을 분리한다 */
interface ParsedRangeInfo {
  readonly operator: string;
  readonly version: SemverParts;
  readonly raw: string;
}

/**
 * 범위 문자열에서 연산자와 SemverParts를 추출한다.
 * @param range - semver 범위 문자열
 */
function parseRangeInfo(range: string): ParsedRangeInfo {
  const trimmed = range.trim();

  if (trimmed.startsWith('>=')) {
    return { operator: '>=', version: parseSemver(trimmed.slice(2)), raw: trimmed };
  }
  if (trimmed.startsWith('^')) {
    return { operator: '^', version: parseSemver(trimmed.slice(1)), raw: trimmed };
  }
  if (trimmed.startsWith('~')) {
    return { operator: '~', version: parseSemver(trimmed.slice(1)), raw: trimmed };
  }

  return { operator: '=', version: parseSemver(trimmed), raw: trimmed };
}

/**
 * SemverParts를 "major.minor.patch" 문자열로 변환한다.
 * @param parts - semver 구성 요소
 */
function versionToString(parts: SemverParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

/**
 * 두 범위가 서로 호환되는지 판정한다.
 * @param a - 첫 번째 범위 정보
 * @param b - 두 번째 범위 정보
 * @returns 'compatible' | 'warning' | 'error'
 */
function checkPairCompatibility(
  a: ParsedRangeInfo,
  b: ParsedRangeInfo,
): 'compatible' | 'warning' | 'error' {
  /* 정확 일치 범위끼리 버전이 다르면 에러 */
  if (a.operator === '=' && b.operator === '=') {
    return versionToString(a.version) === versionToString(b.version) ? 'compatible' : 'error';
  }

  /* 정확 일치가 다른 범위를 만족하는지 확인 */
  if (a.operator === '=') {
    return satisfiesRange(versionToString(a.version), b.raw) ? 'compatible' : 'error';
  }
  if (b.operator === '=') {
    return satisfiesRange(versionToString(b.version), a.raw) ? 'compatible' : 'error';
  }

  /* 서로 다른 major → 에러 */
  if (a.version.major !== b.version.major) {
    return 'error';
  }

  /* 같은 major, ^ 범위끼리 → 호환 */
  if (a.operator === '^' && b.operator === '^') {
    return 'compatible';
  }

  /* ~ 범위끼리: minor가 같아야 호환 */
  if (a.operator === '~' && b.operator === '~') {
    return a.version.minor === b.version.minor ? 'compatible' : 'error';
  }

  /* ^ + ~ 혼합: ~의 min 버전이 ^의 범위를 만족하면 호환, 아니면 경고 */
  const tildeRange = a.operator === '~' ? a : b;
  const caretRange = a.operator === '^' ? a : b;
  const tildeMin = versionToString(tildeRange.version);

  if (satisfiesRange(tildeMin, caretRange.raw)) {
    return 'compatible';
  }

  return 'error';
}

/**
 * 여러 앱의 범위 목록 전체에서 가장 심각한 충돌 수준을 판정한다.
 * @param ranges - 파싱된 범위 목록
 * @returns 가장 심각한 충돌 수준
 */
function determineWorstCompatibility(
  ranges: readonly ParsedRangeInfo[],
): 'compatible' | 'warning' | 'error' {
  const results: ('compatible' | 'warning' | 'error')[] = [];

  for (const [i, a] of ranges.entries()) {
    for (const b of ranges.slice(i + 1)) {
      results.push(checkPairCompatibility(a, b));
    }
  }

  if (results.includes('error')) {
    return 'error';
  }
  if (results.includes('warning')) {
    return 'warning';
  }
  return 'compatible';
}

/**
 * 여러 MFE 매니페스트에서 의존성 충돌을 분석한다.
 * @param declarations - 앱별 의존성 선언 목록
 */
export function analyzeDependencyConflicts(
  declarations: readonly AppDependencyDeclaration[],
): DependencyAnalysisResult {
  /* 의존성 이름별로 앱+범위 그룹핑 */
  const depMap = new Map<string, ConflictApp[]>();

  for (const decl of declarations) {
    for (const [depName, versionRange] of decl.dependencies) {
      const existing = depMap.get(depName) ?? [];
      existing.push({ appName: decl.appName, versionRange });
      depMap.set(depName, existing);
    }
  }

  const errors: DependencyConflict[] = [];
  const warnings: DependencyConflict[] = [];

  for (const [depName, apps] of depMap) {
    /* 단일 앱만 사용하면 충돌 불가 */
    if (apps.length < 2) {
      continue;
    }

    const ranges = apps.map((app) => parseRangeInfo(app.versionRange));
    const compatibility = determineWorstCompatibility(ranges);

    if (compatibility === 'compatible') {
      continue;
    }

    const rangesDescription = apps.map((a) => `${a.appName}@${a.versionRange}`).join(', ');

    const conflict: DependencyConflict = {
      dependencyName: depName,
      apps,
      severity: compatibility,
      message:
        compatibility === 'error'
          ? `Incompatible versions of "${depName}": ${rangesDescription}`
          : `Potentially incompatible versions of "${depName}": ${rangesDescription}`,
    };

    if (compatibility === 'error') {
      errors.push(conflict);
    } else {
      warnings.push(conflict);
    }
  }

  const totalConflicts = errors.length + warnings.length;
  const summary =
    totalConflicts === 0
      ? 'No dependency conflicts detected.'
      : `Found ${errors.length} error(s) and ${warnings.length} warning(s).`;

  return {
    conflicts: errors,
    warnings,
    summary,
  };
}
