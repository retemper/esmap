import type { EsmapConfig, ImportMap } from '@esmap/shared';
import type { AppRegistry, Router, LifecycleHooks, PrefetchController, RouterOptions, SharedModuleRegistry } from '@esmap/runtime';
import type { PerfTracker } from '@esmap/monitor';
import type { EsmapPlugin } from './plugin.js';

/** createEsmap에 전달하는 설정 */
export interface EsmapOptions {
  /** esmap 설정 (앱 목록, 공유 의존성 등) */
  readonly config: EsmapConfig;
  /** import map. inline 또는 URL로 로드한 결과 */
  readonly importMap?: ImportMap;
  /** 라우터 옵션 (baseUrl, onNoMatch 등) */
  readonly router?: RouterOptions;
  /** 성능 추적 비활성화 여부 */
  readonly disablePerf?: boolean;
  /** devtools 비활성화 여부 */
  readonly disableDevtools?: boolean;
  /** 플러그인 목록. install 순서대로 실행되고, destroy 시 역순으로 정리된다. */
  readonly plugins?: readonly EsmapPlugin[];
}

/** createEsmap이 반환하는 통합 인스턴스 */
export interface EsmapInstance {
  /** 앱 레지스트리 — 앱 등록, 로드, 마운트/언마운트 */
  readonly registry: AppRegistry;
  /** 라우터 — URL 기반 앱 활성화 */
  readonly router: Router;
  /** 라이프사이클 훅 — before/after 글로벌/앱별 훅 */
  readonly hooks: LifecycleHooks;
  /** 성능 트래커 — 라이프사이클 자동 계측 */
  readonly perf: PerfTracker;
  /** 프리페치 컨트롤러 */
  readonly prefetch: PrefetchController;
  /** 공유 모듈 레지스트리 — MFE 간 의존성 공유 및 버전 협상 */
  readonly sharedModules: SharedModuleRegistry;
  /** 프레임워크를 시작한다 (라우터 리스닝 + 초기 라우트 처리) */
  start(): Promise<void>;
  /** 프레임워크를 완전히 정리한다 (모든 앱 언마운트 + 라우터 중지) */
  destroy(): Promise<void>;
}
