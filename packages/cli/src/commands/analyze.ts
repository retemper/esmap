import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { glob } from 'node:fs/promises';
import { analyzeDependencyConflicts } from '../analyze-deps.js';
import { extractDeclarationsFromManifests } from '../analyze-manifests.js';

/** Options for the analyze command */
export interface AnalyzeOptions {
  /** Glob pattern for manifest files */
  readonly manifests: string;
  /** Config file path */
  readonly config?: string;
}

/**
 * Extracts AnalyzeOptions from the flag map.
 * @param flags - parsed CLI flags
 */
export function parseAnalyzeFlags(flags: Readonly<Record<string, string>>): AnalyzeOptions {
  return {
    manifests: flags['manifests'] ?? '**/esmap-manifest.json',
    config: flags['config'],
  };
}

/** Type of the function that discovers manifest file paths (for test injection) */
type DiscoverFn = (pattern: string) => Promise<readonly string[]>;

/**
 * Discovers manifest file paths using a glob pattern.
 * @param pattern - glob pattern
 */
async function defaultDiscover(pattern: string): Promise<readonly string[]> {
  const paths: string[] = [];
  for await (const entry of glob(pattern)) {
    paths.push(resolve(String(entry)));
  }
  return paths;
}

/**
 * Formats the analysis result as a human-readable string.
 * @param result - dependency analysis result
 */
export function formatAnalysisResult(
  result: ReturnType<typeof analyzeDependencyConflicts>,
): string {
  const lines: string[] = [];

  lines.push('=== Dependency Conflict Analysis ===');
  lines.push('');

  if (result.conflicts.length > 0) {
    lines.push('Errors:');
    for (const conflict of result.conflicts) {
      lines.push(`  [ERROR] ${conflict.message}`);
      for (const app of conflict.apps) {
        lines.push(`    - ${app.appName}: ${app.versionRange}`);
      }
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  [WARN] ${warning.message}`);
      for (const app of warning.apps) {
        lines.push(`    - ${app.appName}: ${app.versionRange}`);
      }
    }
    lines.push('');
  }

  lines.push(result.summary);

  return lines.join('\n');
}

/**
 * Runs the dependency conflict analysis.
 * @param options - analyze options
 * @param discoverFn - manifest discovery function (for test injection)
 * @param readFn - file read function (for test injection)
 */
export async function analyze(
  options: AnalyzeOptions,
  discoverFn: DiscoverFn = defaultDiscover,
  readFn: typeof readFile = readFile,
): Promise<ReturnType<typeof analyzeDependencyConflicts>> {
  const manifestPaths = await discoverFn(options.manifests);

  if (manifestPaths.length === 0) {
    console.log('No manifest files found.');
    return { conflicts: [], warnings: [], summary: 'No manifest files found.' };
  }

  const declarations = await extractDeclarationsFromManifests(manifestPaths, readFn);
  const result = analyzeDependencyConflicts(declarations);

  console.log(formatAnalysisResult(result));

  if (result.conflicts.length > 0) {
    process.exitCode = 1;
  }

  return result;
}

/**
 * Runs the analyze command.
 * @param flags - parsed CLI flags
 */
export async function runAnalyze(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseAnalyzeFlags(flags);
  await analyze(options);
}

/** Help text for the analyze command */
export const ANALYZE_HELP = `Usage: esmap analyze [options]

Options:
  --manifests <glob>  Glob pattern for manifest files (default: **/esmap-manifest.json)
  --config <path>     Config file path
  --help              Show this help message`;
