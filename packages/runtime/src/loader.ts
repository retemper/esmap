import type { ImportMap } from '@esmap/shared';
import { ImportMapLoadError } from '@esmap/shared';

/** import map 로더 공통 옵션 */
interface LoaderBaseOptions {
  /** modulepreload 힌트를 자동 주입할지 여부 */
  readonly injectPreload?: boolean;
}

/** URL에서 import map을 fetch하는 서버 모드 옵션 */
interface LoaderUrlOptions extends LoaderBaseOptions {
  /** import map JSON을 가져올 URL */
  readonly importMapUrl: string;
  readonly inlineImportMap?: never;
}

/** 인라인 import map 객체를 사용하는 정적 모드 옵션 */
interface LoaderInlineOptions extends LoaderBaseOptions {
  readonly importMapUrl?: never;
  /** 인라인 import map 객체 */
  readonly inlineImportMap: ImportMap;
}

/**
 * import map 로더 옵션.
 * importMapUrl 또는 inlineImportMap 중 하나를 반드시 제공해야 한다.
 */
export type LoaderOptions = LoaderUrlOptions | LoaderInlineOptions;

/**
 * import map을 로드하고 DOM에 적용한다.
 * 네이티브 import map이 이미 있으면 건너뛴다.
 * @param options - 로더 옵션
 */
export async function loadImportMap(options: LoaderOptions): Promise<ImportMap> {
  const importMap = await resolveImportMap(options);

  if (!hasExistingImportMap()) {
    injectImportMapScript(importMap);
  }

  if (options.injectPreload !== false) {
    injectModulePreloadHints(importMap);
  }

  return importMap;
}

/** import map을 URL에서 가져오거나 인라인 객체를 사용한다. */
async function resolveImportMap(options: LoaderOptions): Promise<ImportMap> {
  if (options.inlineImportMap) {
    return options.inlineImportMap;
  }

  if (options.importMapUrl) {
    const response = await fetch(options.importMapUrl);
    if (!response.ok) {
      throw new ImportMapLoadError(
        `Import map 로드 실패: ${response.status} ${response.statusText}`,
        {
          url: options.importMapUrl,
          status: response.status,
        },
      );
    }
    const json: unknown = await response.json();
    return parseImportMapJson(json, options.importMapUrl);
  }

  throw new ImportMapLoadError('importMapUrl 또는 inlineImportMap 중 하나는 필수입니다');
}

/** JSON 응답이 유효한 ImportMap 구조인지 확인하는 타입 가드 */
function isImportMap(value: unknown): value is ImportMap {
  if (typeof value !== 'object' || value === null) return false;
  if (!('imports' in value) || typeof value.imports !== 'object' || value.imports === null) {
    return false;
  }
  return Object.values(value.imports).every((v) => typeof v === 'string');
}

/** JSON 응답을 ImportMap으로 파싱한다. 유효하지 않으면 에러를 던진다. */
function parseImportMapJson(json: unknown, url: string): ImportMap {
  if (isImportMap(json)) {
    return json;
  }
  throw new ImportMapLoadError(`Import map 형식이 올바르지 않습니다: ${url}`);
}

/** 이미 적용된 import map이 있는지 확인한다. */
function hasExistingImportMap(): boolean {
  return document.querySelector('script[type="importmap"]') !== null;
}

/** import map JSON을 <script type="importmap">으로 DOM에 주입한다. */
function injectImportMapScript(importMap: ImportMap): void {
  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = JSON.stringify(importMap);

  const firstScript = document.querySelector('script[type="module"]');
  if (firstScript) {
    firstScript.before(script);
  } else {
    document.head.appendChild(script);
  }
}

/** import map의 모든 모듈에 대해 modulepreload 링크를 주입한다. */
function injectModulePreloadHints(importMap: ImportMap): void {
  const existingPreloads = new Set(
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')).map(
      (link) => link.href,
    ),
  );

  for (const url of Object.values(importMap.imports)) {
    if (!existingPreloads.has(url) && url.endsWith('.js')) {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = url;
      document.head.appendChild(link);
    }
  }
}
