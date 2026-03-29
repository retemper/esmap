import type { MfeManifest } from '../types/manifest.js';
import { ManifestValidationError } from '../errors.js';
import { isRecord } from './type-guards.js';

/**
 * MFE 매니페스트 JSON을 파싱하고 유효성을 검증한다.
 * @param json - 매니페스트 JSON 문자열
 */
export function parseManifest(json: string): MfeManifest {
  const parsed: unknown = JSON.parse(json);
  return validateManifest(parsed);
}

/**
 * 매니페스트 객체의 유효성을 검증한다.
 * @param value - 검증할 값
 */
export function validateManifest(value: unknown): MfeManifest {
  if (!isRecord(value)) {
    throw new ManifestValidationError(['Manifest must be a JSON object']);
  }

  const errors: string[] = [];

  if (typeof value.name !== 'string' || value.name.length === 0) {
    errors.push('"name" must be a non-empty string');
  }

  if (typeof value.version !== 'string' || value.version.length === 0) {
    errors.push('"version" must be a non-empty string');
  }

  if (typeof value.entry !== 'string' || value.entry.length === 0) {
    errors.push('"entry" must be a non-empty string');
  }

  if (!Array.isArray(value.assets)) {
    errors.push('"assets" must be an array');
  } else if (!value.assets.every((a: unknown) => typeof a === 'string')) {
    errors.push('"assets" must contain only strings');
  }

  if (!isRecord(value.dependencies)) {
    errors.push('"dependencies" must be an object');
  } else {
    if (!Array.isArray(value.dependencies.shared)) {
      errors.push('"dependencies.shared" must be an array');
    }
    if (!Array.isArray(value.dependencies.internal)) {
      errors.push('"dependencies.internal" must be an array');
    }
  }

  if (!Array.isArray(value.modulepreload)) {
    errors.push('"modulepreload" must be an array');
  }

  if (errors.length > 0) {
    throw new ManifestValidationError(errors);
  }

  const deps = value.dependencies;
  if (!isRecord(deps)) {
    throw new ManifestValidationError(['"dependencies" must be an object']);
  }

  return buildValidatedManifest(value, deps);
}

/**
 * unknown 값을 string 배열로 변환한다. 사전에 Array.isArray 검증이 완료된 값에만 사용한다.
 * @param value - 배열로 검증된 unknown 값
 */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/**
 * 검증을 통과한 값으로부터 MfeManifest를 안전하게 구성한다.
 * @param value - 검증 완료된 Record
 * @param deps - 검증 완료된 dependencies Record
 */
function buildValidatedManifest(
  value: Record<string, unknown>,
  deps: Record<string, unknown>,
): MfeManifest {
  return {
    name: String(value.name),
    version: String(value.version),
    entry: String(value.entry),
    assets: toStringArray(value.assets),
    dependencies: {
      shared: toStringArray(deps.shared),
      internal: toStringArray(deps.internal),
    },
    modulepreload: toStringArray(value.modulepreload),
    ...(isRecord(value.metadata) ? { metadata: value.metadata } : {}),
  };
}

/**
 * 매니페스트에서 CDN URL을 생성한다.
 * @param manifest - MFE 매니페스트
 * @param cdnBase - CDN 기본 URL (예: "https://cdn.flex.team")
 * @param appPath - 앱 경로 prefix (예: "apps/checkout")
 */
export function resolveManifestUrls(
  manifest: MfeManifest,
  cdnBase: string,
  appPath: string,
): {
  readonly entryUrl: string;
  readonly assetUrls: readonly string[];
  readonly preloadUrls: readonly string[];
} {
  const base = cdnBase.replace(/\/$/, '');
  const path = appPath.replace(/^\/|\/$/g, '');

  return {
    entryUrl: `${base}/${path}/${manifest.entry}`,
    assetUrls: manifest.assets.map((asset) => `${base}/${path}/${asset}`),
    preloadUrls: manifest.modulepreload.map((mod) => `${base}/${path}/${mod}`),
  };
}
