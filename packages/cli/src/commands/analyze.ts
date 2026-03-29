import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { glob } from 'node:fs/promises';
import { analyzeDependencyConflicts } from '../analyze-deps.js';
import { extractDeclarationsFromManifests } from '../analyze-manifests.js';

/** analyze 커맨드의 옵션 */
export interface AnalyzeOptions {
  /** 매니페스트 파일 glob 패턴 */
  readonly manifests: string;
  /** 설정 파일 경로 */
  readonly config?: string;
}

/**
 * 플래그 맵에서 AnalyzeOptions를 추출한다.
 * @param flags - 파싱된 CLI 플래그
 */
export function parseAnalyzeFlags(flags: Readonly<Record<string, string>>): AnalyzeOptions {
  return {
    manifests: flags['manifests'] ?? '**/esmap-manifest.json',
    config: flags['config'],
  };
}

/** 매니페스트 파일 경로를 탐색하는 함수의 타입 (테스트 주입용) */
type DiscoverFn = (pattern: string) => Promise<readonly string[]>;

/**
 * glob 패턴으로 매니페스트 파일 경로를 탐색한다.
 * @param pattern - glob 패턴
 */
async function defaultDiscover(pattern: string): Promise<readonly string[]> {
  const paths: string[] = [];
  for await (const entry of glob(pattern)) {
    paths.push(resolve(String(entry)));
  }
  return paths;
}

/**
 * 분석 결과를 사람이 읽기 좋은 문자열로 포맷한다.
 * @param result - 의존성 분석 결과
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
 * 의존성 충돌 분석을 실행한다.
 * @param options - analyze 옵션
 * @param discoverFn - 매니페스트 탐색 함수 (테스트 주입용)
 * @param readFn - 파일 읽기 함수 (테스트 주입용)
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
 * analyze 커맨드를 실행한다.
 * @param flags - 파싱된 CLI 플래그
 */
export async function runAnalyze(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseAnalyzeFlags(flags);
  await analyze(options);
}

/** analyze 커맨드의 도움말 텍스트 */
export const ANALYZE_HELP = `Usage: esmap analyze [options]

Options:
  --manifests <glob>  Glob pattern for manifest files (default: **/esmap-manifest.json)
  --config <path>     Config file path
  --help              Show this help message`;
