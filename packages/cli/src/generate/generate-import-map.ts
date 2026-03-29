import type { ImportMap, MfeManifest, EsmapConfig, SharedDependencyManifest } from '@esmap/shared';
import { serializeImportMap } from '@esmap/shared';

/** import map 생성에 필요한 입력 */
export interface GenerateInput {
  /** 프레임워크 설정 */
  readonly config: EsmapConfig;
  /** 각 MFE의 매니페스트 (앱 이름 → 매니페스트) */
  readonly manifests: Readonly<Record<string, MfeManifest>>;
  /** 공유 의존성 매니페스트 (패키지 이름 → 매니페스트) */
  readonly sharedManifests?: Readonly<Record<string, SharedDependencyManifest>>;
}

/** import map 생성 결과 */
export interface GenerateResult {
  /** 생성된 import map 객체 */
  readonly importMap: ImportMap;
  /** JSON 문자열 (pretty-printed) */
  readonly json: string;
  /** modulepreload 대상 URL 목록 (앱 이름 → URL 목록) */
  readonly preloadHints: Readonly<Record<string, readonly string[]>>;
}

/**
 * 설정과 매니페스트로부터 import map JSON을 생성한다.
 * @param input - 생성에 필요한 설정, 매니페스트 데이터
 */
export function generateImportMap(input: GenerateInput): GenerateResult {
  const { config, manifests, sharedManifests } = input;
  const cdnBase = (config.cdnBase ?? '').replace(/\/$/, '');

  const imports: Record<string, string> = {};
  const scopes: Record<string, Record<string, string>> = {};
  const preloadHints: Record<string, string[]> = {};

  addSharedImports(imports, config, sharedManifests, cdnBase);
  addAppImports(imports, scopes, preloadHints, config, manifests, cdnBase);

  const importMap: ImportMap = {
    imports,
    ...(Object.keys(scopes).length > 0 ? { scopes } : {}),
  };

  return {
    importMap,
    json: serializeImportMap(importMap),
    preloadHints,
  };
}

/** 공유 의존성 imports 항목을 추가한다. */
function addSharedImports(
  imports: Record<string, string>,
  config: EsmapConfig,
  sharedManifests: Readonly<Record<string, SharedDependencyManifest>> | undefined,
  cdnBase: string,
): void {
  for (const [name, sharedConfig] of Object.entries(config.shared)) {
    if (sharedConfig.url) {
      imports[name] = sharedConfig.url;
      continue;
    }

    const manifest = sharedManifests?.[name];
    if (manifest) {
      for (const [subpath, url] of Object.entries(manifest.exports)) {
        const specifier = subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;
        imports[specifier] = url.startsWith('http') ? url : `${cdnBase}/${url}`;
      }
      continue;
    }

    if (sharedConfig.subpaths) {
      for (const [subpath, target] of Object.entries(sharedConfig.subpaths)) {
        const specifier = `${name}/${subpath.replace(/^\.\//, '')}`;
        imports[specifier] = target.startsWith('http') ? target : `${cdnBase}/${target}`;
      }
    }
  }
}

/** MFE 앱의 imports와 scopes 항목을 추가한다. */
function addAppImports(
  imports: Record<string, string>,
  scopes: Record<string, Record<string, string>>,
  preloadHints: Record<string, string[]>,
  config: EsmapConfig,
  manifests: Readonly<Record<string, MfeManifest>>,
  cdnBase: string,
): void {
  for (const [appName, appConfig] of Object.entries(config.apps)) {
    const manifest = manifests[appName];
    if (!manifest) continue;

    const appBase = `${cdnBase}/${appConfig.path.replace(/^\/|\/$/g, '')}`;
    const entryUrl = `${appBase}/${manifest.entry}`;

    imports[appName] = entryUrl;

    preloadHints[appName] = (manifest.modulepreload ?? []).map((mod) => `${appBase}/${mod}`);
  }
}
