/** Major, minor, and patch components of a semver version */
export interface SemverParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Semver range operator types */
type RangeOperator = '^' | '~' | '>=' | '=';

/** Parsed semver range expression */
interface ParsedRange {
  readonly operator: RangeOperator;
  readonly version: SemverParts;
}

/**
 * Parses a version string into major, minor, and patch.
 * @param version - version string in "18.3.1" format
 * @returns parsed SemverParts object
 */
export function parseSemver(version: string): SemverParts {
  const cleaned = version.replace(/^v/, '');

  if (cleaned === '') {
    throw new Error(`Invalid semver version: ${version}`);
  }

  const parts = cleaned.split('.');

  if (parts.length < 1 || parts.length > 3) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  const major = Number(parts[0]);
  const minor = parts.length >= 2 ? Number(parts[1]) : 0;
  const patch = parts.length >= 3 ? Number(parts[2]) : 0;

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  return { major, minor, patch };
}

/**
 * Parses a range string into an operator and version.
 * @param range - range string in "^18.0.0", "~18.3.0", ">=18.0.0", "18.3.1" format
 * @returns parsed range object
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
 * Compares two version strings.
 * @param a - first version to compare
 * @param b - second version to compare
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
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
 * Checks whether a version satisfies a given range.
 * Supported patterns: ^ (compatible), ~ (approximately), >= (minimum), exact match
 * @param version - version string to check (e.g. "18.3.1")
 * @param range - semver range string (e.g. "^18.0.0")
 * @returns whether the version satisfies the range
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
 * Checks whether a version satisfies a caret range (^).
 * If major is non-zero, satisfies when >= range version within the same major.
 * If major is 0, minor must also match.
 * @param version - version to check
 * @param range - range version
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
 * Checks whether a version satisfies a tilde range (~).
 * Satisfies when >= range version within the same major.minor.
 * @param version - version to check
 * @param range - range version
 */
function satisfiesTilde(version: SemverParts, range: SemverParts): boolean {
  // ~1.2.3 := >=1.2.3 <1.3.0
  if (version.major !== range.major || version.minor !== range.minor) {
    return false;
  }
  return version.patch >= range.patch;
}
