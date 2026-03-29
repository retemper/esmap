import { readFile } from 'node:fs/promises';
import type { MfeManifest } from '@esmap/shared';
import type { AppDependencyDeclaration } from './analyze-deps.js';

/** 파일 읽기 함수의 타입 (테스트 주입용) */
type ReadFileFn = (path: string, encoding: BufferEncoding) => Promise<string | Buffer>;

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
    typeof value.entry === 'string'
  );
}

/**
 * 매니페스트 객체에서 의존성 버전 맵을 안전하게 추출한다.
 * metadata.dependencyVersions에 Record<string, string> 형태로 저장되어 있다고 가정한다.
 * @param manifest - MFE 매니페스트
 */
function extractVersionMap(manifest: MfeManifest): ReadonlyMap<string, string> {
  const result = new Map<string, string>();

  const metadata = manifest.metadata;
  if (metadata === undefined || typeof metadata !== 'object') {
    return result;
  }

  const versions = metadata['dependencyVersions'];
  if (versions === undefined || typeof versions !== 'object' || versions === null) {
    return result;
  }

  for (const [key, value] of Object.entries(versions)) {
    if (typeof value === 'string') {
      result.set(key, value);
    }
  }

  return result;
}

/**
 * 매니페스트 파일 경로 목록에서 의존성 선언을 추출한다.
 * @param manifestPaths - 매니페스트 JSON 파일 경로 목록
 * @param readFn - 파일 읽기 함수 (테스트 주입용)
 */
export async function extractDeclarationsFromManifests(
  manifestPaths: readonly string[],
  readFn: ReadFileFn = readFile,
): Promise<readonly AppDependencyDeclaration[]> {
  const declarations: AppDependencyDeclaration[] = [];

  for (const manifestPath of manifestPaths) {
    try {
      const content = await readFn(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(content.toString());

      if (!isMfeManifest(parsed)) {
        continue;
      }

      const dependencies = extractVersionMap(parsed);

      declarations.push({
        appName: parsed.name,
        dependencies,
      });
    } catch {
      /* 파일을 읽을 수 없거나 JSON 파싱에 실패하면 건너뛴다 */
    }
  }

  return declarations;
}
