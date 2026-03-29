import type { MfeApp, MfeAppStatus, RegisteredApp, ImportMap } from '@esmap/shared';
import {
  AppNotFoundError,
  AppAlreadyRegisteredError,
  AppLifecycleError,
  ContainerNotFoundError,
  isRecord,
} from '@esmap/shared';
import { createDefaultFallback, renderFallback } from './error-boundary.js';

/** 에러 바운더리 옵션. 앱 로드/마운트 실패 시 폴백 UI를 제어한다. */
export interface ErrorBoundaryOptions {
  /** 폴백 UI를 생성하는 함수. 미지정 시 기본 폴백을 사용한다. */
  readonly fallback?: (appName: string, error: Error) => HTMLElement | string;
  /** 자동 재시도 최대 횟수. 기본값 3. */
  readonly retryLimit?: number;
  /** 재시도 간 딜레이(ms). 기본값 1000. */
  readonly retryDelay?: number;
  /** 에러 발생 시 호출되는 콜백 */
  readonly onError?: (appName: string, error: Error) => void;
}

/** 앱 등록 시 필요한 정보 */
export interface RegisterAppOptions {
  /** 앱 이름 (import map specifier, 예: "@flex/checkout") */
  readonly name: string;
  /** 활성 라우트 매칭 함수 또는 패턴 */
  readonly activeWhen: string | readonly string[] | ((location: Location) => boolean);
  /** 마운트 대상 DOM 셀렉터 */
  readonly container?: string;
  /** 앱별 에러 바운더리 옵션. 레지스트리 기본 옵션을 오버라이드한다. */
  readonly errorBoundary?: ErrorBoundaryOptions;
}

/** AppRegistry 생성 옵션 */
export interface AppRegistryOptions {
  /**
   * import map. bare specifier를 URL로 해석할 때 사용한다.
   * 제공하면 dynamic import 시 URL로 직접 로드하므로
   * 네이티브 import map 타이밍 제약을 우회한다.
   */
  readonly importMap?: ImportMap;
  /** 전역 에러 바운더리 옵션. 모든 앱에 기본 적용된다. */
  readonly errorBoundary?: ErrorBoundaryOptions;
}

/** 앱 상태 변경 이벤트 */
export interface AppStatusChangeEvent {
  readonly appName: string;
  readonly from: MfeAppStatus;
  readonly to: MfeAppStatus;
}

/** 상태 변경 리스너 */
type StatusChangeListener = (event: AppStatusChangeEvent) => void;

/** 기본 재시도 최대 횟수 */
const DEFAULT_RETRY_LIMIT = 3;

/** 기본 재시도 딜레이(ms) */
const DEFAULT_RETRY_DELAY = 1000;

/**
 * MFE 앱을 관리하는 레지스트리.
 * 앱 등록, 상태 관리, 라이프사이클 실행을 담당한다.
 */
export class AppRegistry {
  private readonly apps = new Map<string, RegisteredApp>();
  private readonly listeners: StatusChangeListener[] = [];
  private readonly importMap: ImportMap | undefined;
  private readonly globalErrorBoundary: ErrorBoundaryOptions | undefined;
  private readonly appErrorBoundaries = new Map<string, ErrorBoundaryOptions>();
  private readonly retryCounts = new Map<string, number>();
  /** 진행 중인 loadApp Promise — 동일 앱의 중복 로드를 방지한다 */
  private readonly loadPromises = new Map<string, Promise<void>>();
  /** keep-alive 대상 앱 이름 */
  private readonly keepAliveApps = new Set<string>();

  constructor(options?: AppRegistryOptions) {
    this.importMap = options?.importMap;
    this.globalErrorBoundary = options?.errorBoundary;
  }

  /** 등록된 앱 목록을 반환한다. */
  getApps(): readonly RegisteredApp[] {
    return Array.from(this.apps.values());
  }

  /** 이름으로 앱을 조회한다. */
  getApp(name: string): RegisteredApp | undefined {
    return this.apps.get(name);
  }

  /**
   * 새 MFE 앱을 레지스트리에 등록한다.
   * @param options - 등록 옵션
   */
  registerApp(options: RegisterAppOptions): void {
    if (this.apps.has(options.name)) {
      throw new AppAlreadyRegisteredError(options.name);
    }

    if (options.errorBoundary) {
      this.appErrorBoundaries.set(options.name, options.errorBoundary);
    }

    const resolvedUrl = this.importMap?.imports[options.name];
    const registered: RegisteredApp = {
      name: options.name,
      activeWhen: createActiveWhenFn(options.activeWhen),
      loadApp: () => importMfeApp(resolvedUrl ?? options.name),
      container: options.container ?? '#app',
      status: 'NOT_LOADED',
    };

    this.apps.set(options.name, registered);
  }

  /** 앱을 레지스트리에서 제거한다. 마운트 상태면 먼저 언마운트한다. */
  async unregisterApp(name: string): Promise<void> {
    const app = this.apps.get(name);
    if (!app) return;

    if (app.status === 'MOUNTED') {
      await this.unmountApp(name);
    }

    this.apps.delete(name);
    this.appErrorBoundaries.delete(name);
    this.retryCounts.delete(name);
  }

  /**
   * 앱 모듈을 로드하고 bootstrap한다.
   * NOT_LOADED -> LOADING -> BOOTSTRAPPING -> NOT_MOUNTED
   * 에러 바운더리가 설정되면 실패 시 폴백 UI를 표시한다.
   * 동일 앱에 대한 동시 호출은 하나의 Promise를 공유하여 중복 로드를 방지한다.
   */
  async loadApp(name: string): Promise<void> {
    const registered = this.requireApp(name);
    if (registered.status !== 'NOT_LOADED' && registered.status !== 'LOAD_ERROR') return;

    // 이미 진행 중인 로드가 있으면 같은 Promise를 반환한다
    const existing = this.loadPromises.get(name);
    if (existing) return existing;

    const promise = this.executeLoadApp(name, registered);
    this.loadPromises.set(name, promise);

    try {
      await promise;
    } finally {
      this.loadPromises.delete(name);
    }
  }

  /**
   * 실제 앱 로드 로직을 실행한다.
   * @param name - 앱 이름
   * @param registered - 등록된 앱 정보
   */
  private async executeLoadApp(name: string, registered: RegisteredApp): Promise<void> {
    const errorBoundaryOptions = this.getErrorBoundaryOptions(name);

    this.setStatus(registered, 'LOADING');

    try {
      const app = await registered.loadApp();
      registered.app = app;
      this.setStatus(registered, 'BOOTSTRAPPING');

      await app.bootstrap();
      this.setStatus(registered, 'NOT_MOUNTED');
      this.retryCounts.delete(name);
    } catch (error) {
      this.setStatus(registered, 'LOAD_ERROR');
      const lifecycleError = new AppLifecycleError(
        name,
        'load',
        error instanceof Error ? error : undefined,
      );

      if (errorBoundaryOptions) {
        this.handleErrorWithBoundary(registered, lifecycleError, errorBoundaryOptions);
        return;
      }

      throw lifecycleError;
    }
  }

  /**
   * 앱을 마운트한다.
   * NOT_MOUNTED -> MOUNTED
   * 에러 바운더리가 설정되면 실패 시 폴백 UI를 표시한다.
   */
  async mountApp(name: string): Promise<void> {
    const registered = this.requireApp(name);
    const errorBoundaryOptions = this.getErrorBoundaryOptions(name);

    if (registered.status === 'FROZEN') {
      this.thawApp(registered);
      return;
    }

    if (registered.status === 'NOT_LOADED' || registered.status === 'LOAD_ERROR') {
      await this.loadApp(name);
    }

    if (registered.status !== 'NOT_MOUNTED') return;

    const container = document.querySelector<HTMLElement>(registered.container);
    if (!container) {
      throw new ContainerNotFoundError(registered.container);
    }

    try {
      if (!registered.app) {
        throw new AppLifecycleError(name, 'mount');
      }
      await registered.app.mount(container);
      this.setStatus(registered, 'MOUNTED');
    } catch (error) {
      const mountError =
        error instanceof AppLifecycleError
          ? error
          : new AppLifecycleError(name, 'mount', error instanceof Error ? error : undefined);

      if (errorBoundaryOptions) {
        this.handleErrorWithBoundary(registered, mountError, errorBoundaryOptions);
        return;
      }

      throw mountError;
    }
  }

  /**
   * 앱을 언마운트한다.
   * keep-alive 앱은 MOUNTED -> FROZEN (DOM 보존, 컨테이너 숨김)
   * 일반 앱은 MOUNTED -> UNMOUNTING -> NOT_MOUNTED
   */
  async unmountApp(name: string): Promise<void> {
    const registered = this.requireApp(name);
    if (registered.status !== 'MOUNTED') return;

    if (this.keepAliveApps.has(name)) {
      this.freezeApp(registered);
      return;
    }

    this.setStatus(registered, 'UNMOUNTING');

    const container = document.querySelector<HTMLElement>(registered.container);
    if (container && registered.app) {
      await registered.app.unmount(container);
    }

    this.setStatus(registered, 'NOT_MOUNTED');
  }

  /**
   * 앱의 keep-alive 상태를 설정한다.
   * keep-alive 앱은 언마운트 시 DOM이 보존되고 컨테이너가 숨겨진다.
   * @param name - 앱 이름
   * @param enabled - keep-alive 활성화 여부
   */
  setKeepAlive(name: string, enabled: boolean): void {
    if (enabled) {
      this.keepAliveApps.add(name);
    } else {
      this.keepAliveApps.delete(name);
    }
  }

  /** 앱이 keep-alive 상태인지 반환한다. */
  isKeepAlive(name: string): boolean {
    return this.keepAliveApps.has(name);
  }

  /** 상태 변경 리스너를 등록한다. 해제 함수를 반환한다. */
  onStatusChange(listener: StatusChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** 모든 마운트된/FROZEN 앱을 언마운트하고 레지스트리를 완전히 정리한다. */
  async destroy(): Promise<void> {
    const activeApps = this.getApps().filter(
      (app) => app.status === 'MOUNTED' || app.status === 'FROZEN',
    );

    // FROZEN 앱은 먼저 keep-alive를 해제하여 실제 unmount가 실행되도록 한다
    for (const app of activeApps) {
      this.keepAliveApps.delete(app.name);
      if (app.status === 'FROZEN') {
        this.thawApp(app);
      }
    }

    await Promise.all(activeApps.map((app) => this.unmountApp(app.name)));

    this.apps.clear();
    this.listeners.length = 0;
    this.appErrorBoundaries.clear();
    this.retryCounts.clear();
    this.loadPromises.clear();
    this.keepAliveApps.clear();
  }

  /** 앱의 현재 재시도 횟수를 반환한다. */
  getRetryCount(name: string): number {
    return this.retryCounts.get(name) ?? 0;
  }

  /**
   * 마운트된 앱을 FROZEN 상태로 전환한다.
   * DOM을 보존한 채 컨테이너를 숨겨 빠른 재활성화를 가능하게 한다.
   */
  private freezeApp(registered: RegisteredApp): void {
    const container = document.querySelector<HTMLElement>(registered.container);
    if (container) {
      container.style.display = 'none';
    }
    this.setStatus(registered, 'FROZEN');
  }

  /**
   * FROZEN 상태의 앱을 MOUNTED로 복원한다.
   * 숨겨진 컨테이너를 다시 표시하여 DOM 상태를 즉시 복원한다.
   */
  private thawApp(registered: RegisteredApp): void {
    const container = document.querySelector<HTMLElement>(registered.container);
    if (container) {
      container.style.display = '';
    }
    this.setStatus(registered, 'MOUNTED');
  }

  /** 이름으로 앱을 조회하며, 없으면 에러를 던진다. */
  private requireApp(name: string): RegisteredApp {
    const app = this.apps.get(name);
    if (!app) {
      throw new AppNotFoundError(name);
    }
    return app;
  }

  /** 앱 상태를 변경하고 리스너에 알린다. */
  private setStatus(app: RegisteredApp, status: MfeAppStatus): void {
    const from = app.status;
    app.status = status;
    const event: AppStatusChangeEvent = { appName: app.name, from, to: status };
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** 앱별 또는 전역 에러 바운더리 옵션을 가져온다. */
  private getErrorBoundaryOptions(name: string): ErrorBoundaryOptions | undefined {
    return this.appErrorBoundaries.get(name) ?? this.globalErrorBoundary;
  }

  /**
   * 에러 바운더리로 에러를 처리하고 폴백 UI를 표시한다.
   * 재시도 횟수가 제한에 도달하면 재시도 버튼 없이 영구 폴백을 표시한다.
   */
  private handleErrorWithBoundary(
    registered: RegisteredApp,
    error: AppLifecycleError,
    options: ErrorBoundaryOptions,
  ): void {
    const retryLimit = options.retryLimit ?? DEFAULT_RETRY_LIMIT;
    const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;
    const currentRetryCount = this.retryCounts.get(registered.name) ?? 0;

    options.onError?.(registered.name, error);

    const container = document.querySelector<HTMLElement>(registered.container);
    if (!container) return;

    const isRetryLimitReached = currentRetryCount >= retryLimit;

    if (options.fallback) {
      const fallbackContent = options.fallback(registered.name, error);
      renderFallback(container, fallbackContent);
      return;
    }

    if (isRetryLimitReached) {
      const permanentFallback = createDefaultFallback(registered.name, error, () => {
        /* 재시도 불가 — noop */
      });
      const retryButton = permanentFallback.querySelector('button');
      if (retryButton) {
        retryButton.remove();
      }
      renderFallback(container, permanentFallback);
      return;
    }

    const onRetry = () => {
      const attempt = (this.retryCounts.get(registered.name) ?? 0) + 1;
      this.retryCounts.set(registered.name, attempt);
      this.setStatus(registered, 'NOT_LOADED');

      const exponentialDelay = retryDelay * Math.pow(2, attempt - 1);
      setTimeout(() => {
        void this.loadApp(registered.name);
      }, exponentialDelay);
    };

    const fallbackElement = createDefaultFallback(registered.name, error, onRetry);
    renderFallback(container, fallbackElement);
  }
}

/** activeWhen 옵션을 함수로 변환한다. */
function createActiveWhenFn(
  activeWhen: string | readonly string[] | ((location: Location) => boolean),
): (location: Location) => boolean {
  if (typeof activeWhen === 'function') return activeWhen;

  const patterns = typeof activeWhen === 'string' ? [activeWhen] : activeWhen;

  return (location: Location) => patterns.some((pattern) => location.pathname.startsWith(pattern));
}

/** MFE 모듈을 동적 import한다. URL 또는 bare specifier를 받는다. */
async function importMfeApp(specifierOrUrl: string): Promise<MfeApp> {
  const module: unknown = await import(/* @vite-ignore */ specifierOrUrl);

  if (!isRecord(module)) {
    throw new AppLifecycleError(
      specifierOrUrl,
      'load',
      new Error(
        `모듈이 객체를 export하지 않습니다. ` +
          `MFE 모듈은 bootstrap(), mount(), unmount()를 export해야 합니다.`,
      ),
    );
  }

  if (isValidMfeApp(module.default)) return module.default;
  if (isValidMfeApp(module)) return module;

  const exportedKeys = Object.keys(module).join(', ') || '(없음)';
  const missingMethods = ['bootstrap', 'mount', 'unmount']
    .filter((m) => typeof module[m] !== 'function')
    .join(', ');

  throw new AppLifecycleError(
    specifierOrUrl,
    'load',
    new Error(
      `MFE 라이프사이클 메서드가 누락되었습니다: ${missingMethods}. ` +
        `현재 export: [${exportedKeys}]. ` +
        `모듈은 bootstrap(), mount(), unmount()를 export하거나 default export해야 합니다.`,
    ),
  );
}

/** MfeApp 인터페이스를 구현하는지 검사한다. */
function isValidMfeApp(value: unknown): value is MfeApp {
  if (!isRecord(value)) return false;
  return (
    typeof value.bootstrap === 'function' &&
    typeof value.mount === 'function' &&
    typeof value.unmount === 'function'
  );
}
