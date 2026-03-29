import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { generateImportMap } from '../generate/generate-import-map.js';
import type { GenerateInput } from '../generate/generate-import-map.js';
import type { EsmapConfig, MfeManifest, SharedDependencyManifest } from '@esmap/shared';
import { assertValidConfig } from '@esmap/config';

/** 파일 읽기 함수의 타입 (테스트 주입용) */
type ReadFileFn = (path: string, encoding: BufferEncoding) => Promise<string | Buffer>;

/** 파일 쓰기 함수의 타입 (테스트 주입용) */
type WriteFileFn = (path: string, data: string, encoding: BufferEncoding) => Promise<void>;

/** generate 커맨드의 옵션 */
export interface GenerateOptions {
  /** 설정 파일 경로 */
  readonly config: string;
  /** 출력 파일 경로 (미지정 시 stdout) */
  readonly out?: string;
}

/**
 * 플래그 맵에서 GenerateOptions를 추출한다.
 * @param flags - 파싱된 CLI 플래그
 */
export function parseGenerateFlags(flags: Readonly<Record<string, string>>): GenerateOptions {
  return {
    config: flags['config'] ?? 'esmap.config.json',
    out: flags['out'],
  };
}

/**
 * 앱 설정에서 매니페스트 파일을 탐색하여 로드한다.
 * @param config - esmap 설정
 * @param basePath - 설정 파일 기준 디렉토리
 * @param readFn - 파일 읽기 함수
 */
export async function discoverManifests(
  config: EsmapConfig,
  basePath: string,
  readFn: ReadFileFn = readFile,
): Promise<Record<string, MfeManifest>> {
  const manifests: Record<string, MfeManifest> = {};

  for (const [appName, appConfig] of Object.entries(config.apps)) {
    const manifestPath = appConfig.manifestPath ?? `${appConfig.path}/manifest.json`;
    const fullPath = resolve(basePath, manifestPath);

    try {
      const content = await readFn(fullPath, 'utf-8');
      const parsed: unknown = JSON.parse(content.toString());

      if (isMfeManifest(parsed)) {
        manifests[appName] = parsed;
      }
    } catch {
      // 매니페스트 파일이 없으면 건너뛴다
    }
  }

  return manifests;
}

/**
 * 공유 의존성 매니페스트를 탐색하여 로드한다.
 * @param config - esmap 설정
 * @param basePath - 설정 파일 기준 디렉토리
 * @param readFn - 파일 읽기 함수
 */
export async function discoverSharedManifests(
  config: EsmapConfig,
  basePath: string,
  readFn: ReadFileFn = readFile,
): Promise<Record<string, SharedDependencyManifest>> {
  const manifests: Record<string, SharedDependencyManifest> = {};

  for (const name of Object.keys(config.shared)) {
    const manifestPath = `shared/${name}/manifest.json`;
    const fullPath = resolve(basePath, manifestPath);

    try {
      const content = await readFn(fullPath, 'utf-8');
      const parsed: unknown = JSON.parse(content.toString());

      if (isSharedDependencyManifest(parsed)) {
        manifests[name] = parsed;
      }
    } catch {
      // 매니페스트 파일이 없으면 건너뛴다
    }
  }

  return manifests;
}

/**
 * 설정과 매니페스트로부터 import map을 생성하고 출력한다.
 * @param options - generate 옵션
 * @param readFileFn - 파일 읽기 함수 (테스트 주입용)
 * @param writeFileFn - 파일 쓰기 함수 (테스트 주입용)
 */
export async function generate(
  options: GenerateOptions,
  readFileFn: ReadFileFn = readFile,
  writeFileFn: WriteFileFn = writeFile,
): Promise<string> {
  const configPath = resolve(options.config);
  const basePath = dirname(configPath);

  const configContent = await readFileFn(configPath, 'utf-8');
  const config: unknown = JSON.parse(configContent.toString());

  if (typeof config !== 'object' || config === null) {
    throw new Error(`Invalid config file: ${options.config}`);
  }

  const esmapConfig = assertValidConfig(config);
  const manifests = await discoverManifests(esmapConfig, basePath, readFileFn);
  const sharedManifests = await discoverSharedManifests(esmapConfig, basePath, readFileFn);

  const input: GenerateInput = {
    config: esmapConfig,
    manifests,
    sharedManifests: Object.keys(sharedManifests).length > 0 ? sharedManifests : undefined,
  };

  const result = generateImportMap(input);

  if (options.out) {
    await writeFileFn(resolve(options.out), result.json, 'utf-8');
    console.log(`✓ Import map written to ${options.out}`);
  } else {
    console.log(result.json);
  }

  return result.json;
}

/**
 * generate 커맨드를 실행한다.
 * @param flags - 파싱된 CLI 플래그
 */
export async function runGenerate(flags: Readonly<Record<string, string>>): Promise<void> {
  const options = parseGenerateFlags(flags);
  await generate(options);
}

/**
 * 값이 MfeManifest 구조를 만족하는지 확인한다.
 * @param value - 검증할 값
 */
function isMfeManifest(value: unknown): value is MfeManifest {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'entry' in value &&
    typeof value.entry === 'string' &&
    'assets' in value &&
    Array.isArray(value.assets) &&
    'modulepreload' in value &&
    Array.isArray(value.modulepreload)
  );
}

/**
 * 값이 SharedDependencyManifest 구조를 만족하는지 확인한다.
 * @param value - 검증할 값
 */
function isSharedDependencyManifest(value: unknown): value is SharedDependencyManifest {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'version' in value &&
    typeof value.version === 'string' &&
    'exports' in value &&
    typeof value.exports === 'object'
  );
}

/** generate 커맨드의 도움말 텍스트 */
export const GENERATE_HELP = `Usage: esmap generate [options]

Options:
  --config <path>  Config file path (default: esmap.config.json)
  --out <path>     Output file path (default: stdout)
  --help           Show this help message`;
