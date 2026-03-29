/**
 * esmap.config.ts의 최상위 설정 스키마.
 * defineConfig() 헬퍼를 통해 타입 안전하게 작성한다.
 */
export interface EsmapConfig {
  /** MFE 앱 목록 */
  readonly apps: Readonly<Record<string, AppConfig>>;
  /** 공유 의존성 목록 */
  readonly shared: Readonly<Record<string, SharedConfig>>;
  /** Import map 서버 설정 */
  readonly server?: ServerConfig;
  /** 개발자 도구 설정 */
  readonly devtools?: DevtoolsConfig;
  /** CDN 기본 URL */
  readonly cdnBase?: string;
}

/** 단일 MFE 앱 설정 */
export interface AppConfig {
  /** CDN 상의 앱 경로 prefix (예: "apps/checkout") */
  readonly path: string;
  /** 매니페스트 파일 경로 (로컬 빌드 기준) */
  readonly manifestPath?: string;
  /** 활성 라우트 패턴 (예: "/checkout", ["/checkout", "/cart"]) 또는 커스텀 매칭 함수 */
  readonly activeWhen?: string | readonly string[] | ((location: Location) => boolean);
  /** 마운트될 DOM 컨테이너 셀렉터 */
  readonly container?: string;
}

/** 공유 의존성 설정 */
export interface SharedConfig {
  /** 전역 공유 여부 (모든 MFE에서 동일 인스턴스 사용) */
  readonly global?: boolean;
  /** CDN 상의 URL (자동 생성되지만 수동 오버라이드 가능) */
  readonly url?: string;
  /** subpath exports 매핑 (예: { "./client": "react-dom/client" }) */
  readonly subpaths?: Readonly<Record<string, string>>;
  /** 요구 버전 범위 (semver, 예: "^18.0.0") */
  readonly requiredVersion?: string;
  /** 모든 MFE에서 단일 인스턴스만 사용하도록 강제 */
  readonly singleton?: boolean;
  /** 지연 로딩 대신 즉시 로딩 */
  readonly eager?: boolean;
  /** 버전 불일치 시 엄격 모드 (true: 에러 throw, false: 경고만 출력) */
  readonly strictVersion?: boolean;
}

/** Import map 서버 설정 */
export interface ServerConfig {
  /** 서버 포트 */
  readonly port?: number;
  /** 저장소 타입 */
  readonly storage?: 'filesystem' | 's3' | 'redis';
  /** 저장소별 추가 옵션 */
  readonly storageOptions?: Readonly<Record<string, unknown>>;
  /** 인증 설정 */
  readonly auth?: AuthConfig;
}

/** 인증 설정 */
export interface AuthConfig {
  /** 인증 방식 */
  readonly type: 'api-key' | 'none';
  /** API 키 목록 (환경변수 참조 가능, 예: "$ESMAP_API_KEY") */
  readonly keys?: readonly string[];
}

/** 개발자 도구 설정 */
export interface DevtoolsConfig {
  /** devtools 활성화 여부 */
  readonly enabled?: boolean;
  /** 오버라이드 적용 방식 */
  readonly overrideMode?: 'native-merge' | 'shim';
  /** devtools 트리거 단축키 */
  readonly trigger?: string;
}
