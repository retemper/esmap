/** semver 버전의 major, minor, patch 구성 요소 */
export interface SemverParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** semver 범위 연산자 종류 */
type RangeOperator = '^' | '~' | '>=' | '=';

/** 파싱된 semver 범위 표현식 */
interface ParsedRange {
  readonly operator: RangeOperator;
  readonly version: SemverParts;
}

/**
 * 버전 문자열을 major, minor, patch로 파싱한다.
 * @param version - "18.3.1" 형태의 버전 문자열
 * @returns 파싱된 SemverParts 객체
 */
export function parseSemver(version: string): SemverParts {
  const cleaned = version.replace(/^v/, '');

  if (cleaned === '') {
    throw new Error(`유효하지 않은 semver 버전: ${version}`);
  }

  const parts = cleaned.split('.');

  if (parts.length < 1 || parts.length > 3) {
    throw new Error(`유효하지 않은 semver 버전: ${version}`);
  }

  const major = Number(parts[0]);
  const minor = parts.length >= 2 ? Number(parts[1]) : 0;
  const patch = parts.length >= 3 ? Number(parts[2]) : 0;

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    throw new Error(`유효하지 않은 semver 버전: ${version}`);
  }

  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`유효하지 않은 semver 버전: ${version}`);
  }

  return { major, minor, patch };
}

/**
 * 범위 문자열을 연산자와 버전으로 파싱한다.
 * @param range - "^18.0.0", "~18.3.0", ">=18.0.0", "18.3.1" 형태의 범위 문자열
 * @returns 파싱된 범위 객체
 */
function parseRange(range: string): ParsedRange {
  const trimmed = range.trim();

  if (trimmed.startsWith('>=')) {
    return { operator: '>=', version: parseSemver(trimmed.slice(2)) };
  }

  if (trimmed.startsWith('^')) {
    return { operator: '^', version: parseSemver(trimmed.slice(1)) };
  }

  if (trimmed.startsWith('~')) {
    return { operator: '~', version: parseSemver(trimmed.slice(1)) };
  }

  return { operator: '=', version: parseSemver(trimmed) };
}

/**
 * 두 버전 문자열을 비교한다.
 * @param a - 비교할 첫 번째 버전
 * @param b - 비교할 두 번째 버전
 * @returns a < b이면 -1, a === b이면 0, a > b이면 1
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);

  if (pa.major !== pb.major) {
    return pa.major < pb.major ? -1 : 1;
  }

  if (pa.minor !== pb.minor) {
    return pa.minor < pb.minor ? -1 : 1;
  }

  if (pa.patch !== pb.patch) {
    return pa.patch < pb.patch ? -1 : 1;
  }

  return 0;
}

/**
 * 버전이 주어진 범위를 만족하는지 확인한다.
 * 지원 패턴: ^(호환), ~(근사), >=(최소), 정확 일치
 * @param version - 확인할 버전 문자열 (예: "18.3.1")
 * @param range - semver 범위 문자열 (예: "^18.0.0")
 * @returns 만족 여부
 */
export function satisfiesRange(version: string, range: string): boolean {
  const parsed = parseSemver(version);
  const { operator, version: rangeVersion } = parseRange(range);

  switch (operator) {
    case '=':
      return (
        parsed.major === rangeVersion.major &&
        parsed.minor === rangeVersion.minor &&
        parsed.patch === rangeVersion.patch
      );

    case '>=':
      return (
        compareVersions(
          version,
          `${rangeVersion.major}.${rangeVersion.minor}.${rangeVersion.patch}`,
        ) >= 0
      );

    case '^':
      return satisfiesCaret(parsed, rangeVersion);

    case '~':
      return satisfiesTilde(parsed, rangeVersion);
    default: {
      const _exhaustive: never = operator;
      return _exhaustive;
    }
  }
}

/**
 * caret 범위(^) 만족 여부를 확인한다.
 * major가 0이 아니면 같은 major 내에서 >= range version이면 만족.
 * major가 0이면 minor도 일치해야 한다.
 * @param version - 확인할 버전
 * @param range - 범위 버전
 */
function satisfiesCaret(version: SemverParts, range: SemverParts): boolean {
  if (range.major !== 0) {
    // ^1.2.3 := >=1.2.3 <2.0.0
    if (version.major !== range.major) {
      return false;
    }
    if (version.minor > range.minor) {
      return true;
    }
    if (version.minor === range.minor) {
      return version.patch >= range.patch;
    }
    return false;
  }

  if (range.minor !== 0) {
    // ^0.2.3 := >=0.2.3 <0.3.0
    if (version.major !== 0 || version.minor !== range.minor) {
      return false;
    }
    return version.patch >= range.patch;
  }

  // ^0.0.3 := >=0.0.3 <0.0.4
  return version.major === 0 && version.minor === 0 && version.patch === range.patch;
}

/**
 * tilde 범위(~) 만족 여부를 확인한다.
 * 같은 major.minor 내에서 >= range version이면 만족.
 * @param version - 확인할 버전
 * @param range - 범위 버전
 */
function satisfiesTilde(version: SemverParts, range: SemverParts): boolean {
  // ~1.2.3 := >=1.2.3 <1.3.0
  if (version.major !== range.major || version.minor !== range.minor) {
    return false;
  }
  return version.patch >= range.patch;
}
