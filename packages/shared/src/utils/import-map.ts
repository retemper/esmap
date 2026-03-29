import type { ImportMap, ImportMapMergeStrategy } from '../types/import-map.js';
import { ImportMapError, ImportMapConflictError } from '../errors.js';
import { isRecord } from './type-guards.js';

/**
 * 빈 import map을 생성한다.
 */
export function createEmptyImportMap(): ImportMap {
  return { imports: {} };
}

/**
 * 두 import map을 병합한다.
 * @param base - 기준 import map
 * @param overlay - 덮어씌울 import map
 * @param strategy - 충돌 시 해결 전략
 */
export function mergeImportMaps(
  base: ImportMap,
  overlay: ImportMap,
  strategy: ImportMapMergeStrategy = 'override',
): ImportMap {
  const mergedImports = mergeRecords(base.imports, overlay.imports, strategy);
  const mergedScopes = mergeScopes(base.scopes, overlay.scopes, strategy);
  const mergedIntegrity = mergeOptionalRecords(base.integrity, overlay.integrity, strategy);

  return {
    imports: mergedImports,
    ...(mergedScopes ? { scopes: mergedScopes } : {}),
    ...(mergedIntegrity ? { integrity: mergedIntegrity } : {}),
  };
}

/**
 * import map JSON 문자열을 파싱하고 유효성을 검증한다.
 * @param json - import map JSON 문자열
 */
export function parseImportMap(json: string): ImportMap {
  const parsed: unknown = JSON.parse(json);

  if (!isRecord(parsed)) {
    throw new ImportMapError('Import map must be a JSON object');
  }

  if (!('imports' in parsed) || !isRecord(parsed.imports)) {
    throw new ImportMapError('Import map must have an "imports" object');
  }

  validateStringRecord(parsed.imports, 'imports');
  const imports: Record<string, string> = parsed.imports;

  const scopes = parseScopes(parsed);
  const integrity = parseIntegrity(parsed);

  return {
    imports,
    ...(scopes ? { scopes } : {}),
    ...(integrity ? { integrity } : {}),
  };
}

/**
 * import map 객체에서 scopes를 파싱하고 검증한다.
 * @param parsed - 파싱된 import map 객체
 */
function parseScopes(
  parsed: Record<string, unknown>,
): Record<string, Record<string, string>> | undefined {
  if (!('scopes' in parsed) || parsed.scopes === undefined) return undefined;

  if (!isRecord(parsed.scopes)) {
    throw new ImportMapError('"scopes" must be an object');
  }

  const scopes: Record<string, Record<string, string>> = {};
  for (const [scopeKey, scopeValue] of Object.entries(parsed.scopes)) {
    if (!isRecord(scopeValue)) {
      throw new ImportMapError(`"scopes.${scopeKey}" must be an object`);
    }
    validateStringRecord(scopeValue, `scopes.${scopeKey}`);
    scopes[scopeKey] = scopeValue;
  }
  return scopes;
}

/**
 * import map 객체에서 integrity를 파싱하고 검증한다.
 * @param parsed - 파싱된 import map 객체
 */
function parseIntegrity(parsed: Record<string, unknown>): Record<string, string> | undefined {
  if (!('integrity' in parsed) || parsed.integrity === undefined) return undefined;

  if (!isRecord(parsed.integrity)) {
    throw new ImportMapError('"integrity" must be an object');
  }

  validateStringRecord(parsed.integrity, 'integrity');
  return parsed.integrity;
}

/**
 * import map을 정렬된 JSON 문자열로 직렬화한다.
 * @param importMap - 직렬화할 import map
 * @param indent - 들여쓰기 크기
 */
export function serializeImportMap(importMap: ImportMap, indent = 2): string {
  const sorted: ImportMap = {
    imports: sortRecord(importMap.imports),
    ...(importMap.scopes
      ? {
          scopes: Object.fromEntries(
            Object.entries(importMap.scopes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, sortRecord(value)]),
          ),
        }
      : {}),
    ...(importMap.integrity ? { integrity: sortRecord(importMap.integrity) } : {}),
  };
  return JSON.stringify(sorted, null, indent);
}

/**
 * Record의 값이 모두 string인지 검증하고, 타입 안전한 Record를 반환한다.
 * @param record - 검증할 Record
 * @param path - 에러 메시지용 경로
 */
function validateStringRecord(
  record: Record<string, unknown>,
  path: string,
): asserts record is Record<string, string> {
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'string') {
      throw new ImportMapError(`"${path}.${key}" must be a string, got ${typeof value}`);
    }
  }
}

/**
 * Record를 키 기준으로 알파벳순 정렬한다.
 * @param record - 정렬할 Record
 */
function sortRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * 두 string Record를 병합한다. 충돌 시 strategy에 따라 처리한다.
 * @param base - 기준 레코드
 * @param overlay - 덮어씌울 레코드
 * @param strategy - 충돌 해결 전략
 */
function mergeRecords(
  base: Readonly<Record<string, string>>,
  overlay: Readonly<Record<string, string>>,
  strategy: ImportMapMergeStrategy,
): Record<string, string> {
  const result = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    if (key in result) {
      switch (strategy) {
        case 'override':
          result[key] = value;
          break;
        case 'skip':
          break;
        case 'error':
          throw new ImportMapConflictError(key);
        default: {
          const _exhaustive: never = strategy;
          return _exhaustive;
        }
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * nullable한 두 Record를 병합한다. 둘 다 없으면 undefined를 반환한다.
 * @param base - 기준 레코드 (optional)
 * @param overlay - 덮어씌울 레코드 (optional)
 * @param strategy - 충돌 해결 전략
 */
function mergeOptionalRecords(
  base: Readonly<Record<string, string>> | undefined,
  overlay: Readonly<Record<string, string>> | undefined,
  strategy: ImportMapMergeStrategy,
): Record<string, string> | undefined {
  if (!base && !overlay) return undefined;
  if (!base) return overlay ? { ...overlay } : undefined;
  if (!overlay) return { ...base };
  return mergeRecords(base, overlay, strategy);
}

/**
 * import map의 scopes를 병합한다. 동일 스코프 키는 내부 Record를 병합한다.
 * @param base - 기준 scopes (optional)
 * @param overlay - 덮어씌울 scopes (optional)
 * @param strategy - 충돌 해결 전략
 */
function mergeScopes(
  base: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
  overlay: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined,
  strategy: ImportMapMergeStrategy,
): Record<string, Record<string, string>> | undefined {
  if (!base && !overlay) return undefined;
  if (!base) {
    return overlay
      ? Object.fromEntries(Object.entries(overlay).map(([k, v]) => [k, { ...v }]))
      : undefined;
  }
  if (!overlay) {
    return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { ...v }]));
  }

  const result: Record<string, Record<string, string>> = {};

  for (const [key, value] of Object.entries(base)) {
    result[key] = { ...value };
  }

  for (const [key, value] of Object.entries(overlay)) {
    if (key in result) {
      result[key] = mergeRecords(result[key], value, strategy);
    } else {
      result[key] = { ...value };
    }
  }

  return result;
}
