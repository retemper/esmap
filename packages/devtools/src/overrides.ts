import type { ImportMap } from '@esmap/shared';

/** localStorage에 저장되는 override 맵의 키 */
const STORAGE_KEY = 'esmap:overrides';

/** 개별 override 엔트리 */
export interface OverrideEntry {
  /** 원래 specifier (예: "@flex/checkout") */
  readonly specifier: string;
  /** 대체할 URL (예: "http://localhost:5173/checkout.js") */
  readonly url: string;
}

/**
 * localStorage에서 현재 override 목록을 읽는다.
 * 파싱 실패 시 빈 배열을 반환한다.
 */
export function getOverrides(): readonly OverrideEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidOverrideEntry);
  } catch {
    return [];
  }
}

/**
 * override를 추가하거나 갱신한다. 동일 specifier가 있으면 URL을 덮어쓴다.
 * @param specifier - override할 모듈 specifier
 * @param url - 대체할 URL
 */
export function setOverride(specifier: string, url: string): void {
  try {
    const overrides = [...getOverrides()];
    const existingIndex = overrides.findIndex((o) => o.specifier === specifier);

    if (existingIndex >= 0) {
      overrides[existingIndex] = { specifier, url };
    } else {
      overrides.push({ specifier, url });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* private browsing 또는 quota 초과 시 무시 */
  }
}

/**
 * 특정 specifier의 override를 제거한다.
 * @param specifier - 제거할 모듈 specifier
 */
export function removeOverride(specifier: string): void {
  try {
    const overrides = getOverrides().filter((o) => o.specifier !== specifier);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* private browsing 시 무시 */
  }
}

/** 모든 override를 제거한다. */
export function clearOverrides(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private browsing 시 무시 */
  }
}

/**
 * import map에 override를 적용한다. override가 있는 specifier는 URL이 대체된다.
 * @param importMap - 원본 import map
 * @returns override가 적용된 새 import map
 */
export function applyOverrides(importMap: ImportMap): ImportMap {
  const overrides = getOverrides();
  if (overrides.length === 0) return importMap;

  const overriddenImports = { ...importMap.imports };

  for (const override of overrides) {
    if (override.specifier in overriddenImports) {
      overriddenImports[override.specifier] = override.url;
    }
  }

  return { ...importMap, imports: overriddenImports };
}

/**
 * 현재 override가 활성화되어 있는지 확인한다.
 * @returns override가 하나라도 있으면 true
 */
export function hasActiveOverrides(): boolean {
  return getOverrides().length > 0;
}

/** OverrideEntry 타입 가드 */
function isValidOverrideEntry(value: unknown): value is OverrideEntry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'specifier' in value &&
    typeof value.specifier === 'string' &&
    'url' in value &&
    typeof value.url === 'string'
  );
}
