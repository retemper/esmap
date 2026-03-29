import type { ImportMap } from '@esmap/shared';

/**
 * Webpack Module Federation의 exposed 모듈 선언.
 * mf.config.ts의 exposes 필드에 해당한다.
 */
export interface MfExposedModule {
  /** expose 키 (예: "./Button") */
  readonly key: string;
  /** 파일 경로 (예: "./src/components/Button.tsx") */
  readonly path: string;
}

/**
 * Module Federation remote 앱 설정.
 * 마이그레이션 대상이 되는 기존 MF 설정을 표현한다.
 */
export interface MfRemoteConfig {
  /** 앱 이름 (예: "flexCheckout") */
  readonly name: string;
  /** scope 이름 (예: "@flex/checkout") */
  readonly scope: string;
  /** 앱 진입점 URL (remoteEntry.js) */
  readonly remoteEntryUrl?: string;
  /** expose된 모듈 목록 */
  readonly exposes?: readonly MfExposedModule[];
}

/** Module Federation → import map 변환 옵션 */
export interface MfToImportMapOptions {
  /** CDN base URL */
  readonly cdnBase: string;
  /** 앱별 빌드 결과물 경로 패턴 (기본: "{scope}/{entry}") */
  readonly pathPattern?: string;
}

/**
 * Module Federation remote 설정을 import map 형식으로 변환한다.
 * 각 remote 앱의 scope를 bare specifier로, 빌드 결과물 URL을 값으로 매핑한다.
 *
 * @param remotes - MF remote 앱 설정 목록
 * @param options - 변환 옵션
 * @returns import map 객체
 */
export function convertMfToImportMap(
  remotes: readonly MfRemoteConfig[],
  options: MfToImportMapOptions,
): ImportMap {
  const cdnBase = options.cdnBase.replace(/\/+$/, '');
  const imports: Record<string, string> = {};

  for (const remote of remotes) {
    const scope = remote.scope;
    const appPath = scope.replace('@', '').replace('/', '-');

    // 메인 엔트리
    imports[scope] = `${cdnBase}/${appPath}/index.js`;

    // expose된 서브모듈
    if (remote.exposes) {
      for (const exposed of remote.exposes) {
        const subPath = exposed.key.replace('./', '');
        imports[`${scope}/${subPath}`] = `${cdnBase}/${appPath}/${subPath}.js`;
      }
    }
  }

  return { imports };
}

/**
 * MF shared 의존성 설정에서 공유 라이브러리의 import map 엔트리를 생성한다.
 *
 * @param shared - 공유 라이브러리 이름 → 버전 매핑
 * @param cdnBase - CDN base URL
 * @returns import map의 imports 부분
 */
export function convertMfSharedToImports(
  shared: Readonly<Record<string, string>>,
  cdnBase: string,
): Record<string, string> {
  const base = cdnBase.replace(/\/+$/, '');
  const imports: Record<string, string> = {};

  for (const [name, version] of Object.entries(shared)) {
    const safeName = name.replace('@', '').replace('/', '-');
    imports[name] = `${base}/shared/${safeName}@${version}.js`;
  }

  return imports;
}
