/**
 * MFE 빌드 시 생성되는 매니페스트.
 * 각 MFE가 자신의 모듈 정보를 선언하며, import map 생성의 입력이 된다.
 */
export interface MfeManifest {
  /** 패키지 이름 (예: "@flex/checkout") */
  readonly name: string;
  /** 빌드 버전 */
  readonly version: string;
  /** 엔트리 모듈 파일명 (content-hash 포함, 예: "checkout-a1b2c3.js") */
  readonly entry: string;
  /** 빌드 결과물 전체 파일 목록 */
  readonly assets: readonly string[];
  /** 의존성 선언 */
  readonly dependencies: ManifestDependencies;
  /** modulepreload 대상 모듈 목록 */
  readonly modulepreload: readonly string[];
  /** 확장 메타데이터 */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** 매니페스트의 의존성 구분 */
export interface ManifestDependencies {
  /** import map에서 해석될 bare specifier 목록 (공유 의존성) */
  readonly shared: readonly string[];
  /** 동일 MFE 내부에서만 사용하는 모듈 */
  readonly internal: readonly string[];
}

/**
 * 공유 의존성 빌드 결과물의 매니페스트.
 * CDN에 업로드된 공유 의존성의 URL 정보를 담는다.
 */
export interface SharedDependencyManifest {
  /** 패키지 이름 (예: "react") */
  readonly name: string;
  /** 패키지 버전 (예: "18.3.1") */
  readonly version: string;
  /** subpath → content-hash URL 매핑 */
  readonly exports: Readonly<Record<string, string>>;
}
