import { readFile, access } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import type { EsmapConfig } from '@esmap/shared';
import { assertValidConfig } from './validate.js';

/** 설정 파일명 탐색 순서 */
const CONFIG_FILE_NAMES = [
  'esmap.config.ts',
  'esmap.config.js',
  'esmap.config.mjs',
  'esmap.config.json',
] as const;

/**
 * 프로젝트 디렉토리에서 설정 파일을 탐색하고 로드한다.
 * @param cwd - 탐색 시작 디렉토리 (기본: process.cwd())
 */
export async function loadConfig(cwd?: string): Promise<EsmapConfig> {
  const dir = cwd ?? process.cwd();

  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(dir, fileName);
    const exists = await fileExists(filePath);

    if (exists) {
      return loadConfigFile(filePath);
    }
  }

  throw new Error(
    `설정 파일을 찾을 수 없습니다. 다음 중 하나를 생성하세요: ${CONFIG_FILE_NAMES.join(', ')}`,
  );
}

/**
 * 지정된 경로의 설정 파일을 로드한다.
 * @param filePath - 설정 파일 절대 경로
 */
export async function loadConfigFile(filePath: string): Promise<EsmapConfig> {
  const ext = extname(filePath);

  switch (ext) {
    case '.json':
      return loadJsonConfig(filePath);
    case '.ts':
    case '.js':
    case '.mjs':
      return loadModuleConfig(filePath);
    default:
      throw new Error(`지원하지 않는 설정 파일 확장자: ${ext}`);
  }
}

/**
 * JSON 설정 파일을 로드하고 검증한다.
 * @param filePath - JSON 파일 절대 경로
 */
async function loadJsonConfig(filePath: string): Promise<EsmapConfig> {
  const content = await readFile(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(content);
  return assertValidConfig(parsed);
}

/** TS/JS 모듈 설정 파일을 동적 import로 로드한다. */
async function loadModuleConfig(filePath: string): Promise<EsmapConfig> {
  const module: unknown = await import(filePath).catch((error: unknown) => {
    throw new Error(
      `설정 파일을 로드할 수 없습니다: ${filePath}\n원인: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  const mod = (typeof module === 'object' && module !== null ? module : {}) satisfies object;
  const config = 'default' in mod ? (mod.default ?? mod) : mod;
  return assertValidConfig(config);
}

/**
 * 파일 존재 여부를 확인한다.
 * @param filePath - 확인할 파일 경로
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
