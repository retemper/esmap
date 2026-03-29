/**
 * MFE 앱의 라이프사이클 상태.
 * NOT_MOUNTED에서 MOUNTED로의 재전이가 가능하다 (라우트 재진입 시).
 * FROZEN은 keep-alive 상태로, DOM이 보존된 채 비활성화된다.
 */
export type MfeAppStatus =
  | 'NOT_LOADED'
  | 'LOADING'
  | 'BOOTSTRAPPING'
  | 'NOT_MOUNTED'
  | 'MOUNTED'
  | 'UNMOUNTING'
  | 'FROZEN'
  | 'LOAD_ERROR';

/**
 * MFE 앱이 구현해야 하는 라이프사이클 인터페이스.
 * 각 MFE의 엔트리 모듈은 이 인터페이스를 default export 또는 named export 한다.
 */
export interface MfeApp {
  /** 앱 초기 설정. 한 번만 호출된다. */
  bootstrap(): Promise<void>;
  /** DOM 컨테이너에 앱을 마운트한다. 라우트 진입 시마다 호출될 수 있다. */
  mount(container: HTMLElement): Promise<void>;
  /** DOM 컨테이너에서 앱을 언마운트한다. */
  unmount(container: HTMLElement): Promise<void>;
  /** 마운트 상태에서 props가 변경될 때 호출된다 (선택적). */
  update?(props: Readonly<Record<string, unknown>>): Promise<void>;
}

/**
 * 런타임에 관리되는 MFE 앱 등록 정보.
 */
export interface RegisteredApp {
  /** 앱 이름 (import map specifier, 예: "@flex/checkout") */
  readonly name: string;
  /** 활성 라우트 매칭 함수 */
  readonly activeWhen: (location: Location) => boolean;
  /** 앱 모듈을 로드하는 함수 */
  readonly loadApp: () => Promise<MfeApp>;
  /** 마운트 대상 DOM 셀렉터 */
  readonly container: string;
  /** 현재 상태 (런타임에서만 mutable) */
  status: MfeAppStatus;
  /** 로드된 앱 인스턴스 (로드 후) */
  app?: MfeApp;
}
