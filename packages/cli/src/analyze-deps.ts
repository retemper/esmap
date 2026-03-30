import { parseSemver, satisfiesRange } from '@esmap/runtime';
import type { SemverParts } from '@esmap/runtime';

/** Per-app dependency declaration */
export interface AppDependencyDeclaration {
  readonly appName: string;
  readonly dependencies: ReadonlyMap<string, string>;
}

/** App information involved in a dependency conflict */
interface ConflictApp {
  readonly appName: string;
  readonly versionRange: string;
}

/** Dependency conflict information */
export interface DependencyConflict {
  readonly dependencyName: string;
  readonly apps: readonly ConflictApp[];
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

/** Analysis result */
export interface DependencyAnalysisResult {
  readonly conflicts: readonly DependencyConflict[];
  readonly warnings: readonly DependencyConflict[];
  readonly summary: string;
}

/** Separates the operator and version parts from a range string */
interface ParsedRangeInfo {
  readonly operator: string;
  readonly version: SemverParts;
  readonly raw: string;
}

/**
 * Extracts the operator and SemverParts from a range string.
 * @param range - semver range string
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
 * Converts SemverParts to a "major.minor.patch" string.
 * @param parts - semver components
 */
function versionToString(parts: SemverParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}

/**
 * Determines whether two ranges are compatible with each other.
 * @param a - first range info
 * @param b - second range info
 * @returns 'compatible' | 'warning' | 'error'
 */
function checkPairCompatibility(
  a: ParsedRangeInfo,
  b: ParsedRangeInfo,
): 'compatible' | 'warning' | 'error' {
  /* Error if exact-match ranges have different versions */
  if (a.operator === '=' && b.operator === '=') {
    return versionToString(a.version) === versionToString(b.version) ? 'compatible' : 'error';
  }

  /* Check if an exact version satisfies the other range */
  if (a.operator === '=') {
    return satisfiesRange(versionToString(a.version), b.raw) ? 'compatible' : 'error';
  }
  if (b.operator === '=') {
    return satisfiesRange(versionToString(b.version), a.raw) ? 'compatible' : 'error';
  }

  /* Different major versions -> error */
  if (a.version.major !== b.version.major) {
    return 'error';
  }

  /* Same major, both ^ ranges -> compatible */
  if (a.operator === '^' && b.operator === '^') {
    return 'compatible';
  }

  /* Both ~ ranges: compatible only if minor versions match */
  if (a.operator === '~' && b.operator === '~') {
    return a.version.minor === b.version.minor ? 'compatible' : 'error';
  }

  /* ^ + ~ mixed: compatible if ~'s min version satisfies ^'s range, otherwise error */
  const tildeRange = a.operator === '~' ? a : b;
  const caretRange = a.operator === '^' ? a : b;
  const tildeMin = versionToString(tildeRange.version);

  if (satisfiesRange(tildeMin, caretRange.raw)) {
    return 'compatible';
  }

  return 'error';
}

/**
 * Determines the worst compatibility level across all range pairs from multiple apps.
 * @param ranges - parsed range list
 * @returns the most severe conflict level
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
 * Analyzes dependency conflicts across multiple MFE manifests.
 * @param declarations - per-app dependency declaration list
 */
export function analyzeDependencyConflicts(
  declarations: readonly AppDependencyDeclaration[],
): DependencyAnalysisResult {
  /* Group apps + ranges by dependency name */
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
    /* No conflict possible if only one app uses it */
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
