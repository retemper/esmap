import type { RegisteredApp } from '@esmap/shared';

/** Router가 의존하는 AppRegistry의 최소 인터페이스 */
export interface RouterRegistry {
  /** 등록된 앱 목록을 반환한다. */
  getApps(): readonly RegisteredApp[];
  /** 앱을 마운트한다. */
  mountApp(name: string): Promise<void>;
  /** 앱을 언마운트한다. */
  unmountApp(name: string): Promise<void>;
}

/** 현재 라우트의 위치 정보를 나타내는 컨텍스트 */
export interface RouteContext {
  /** URL 경로 (예: "/users/123") */
  readonly pathname: string;
  /** 쿼리 문자열 (예: "?tab=profile") */
  readonly search: string;
  /** 해시 (예: "#section") */
  readonly hash: string;
}

/**
 * 라우트 변경 전에 실행되는 가드.
 * false를 반환하면 네비게이션이 취소된다.
 */
export type BeforeRouteChangeGuard = (
  from: RouteContext,
  to: RouteContext,
) => Promise<boolean> | boolean;

/**
 * 라우트 변경 후에 실행되는 가드.
 * mount/unmount가 완료된 후 호출된다.
 */
export type AfterRouteChangeGuard = (from: RouteContext, to: RouteContext) => void | Promise<void>;

/**
 * 어떤 앱에도 매칭되지 않는 라우트가 감지되었을 때 호출되는 콜백.
 * @param context - 매칭되지 않은 라우트의 위치 정보
 */
export type NoMatchHandler = (context: RouteContext) => void;

/** 라우터 옵션 */
export interface RouterOptions {
  /** 라우트 변경 감지 방법 */
  readonly mode?: 'history' | 'hash';
  /** 모든 라우트 앞에 붙는 기본 경로 (예: "/my-app"). 마운트 결정 시 이 prefix를 제거한다. */
  readonly baseUrl?: string;
  /** 등록된 앱 중 어느 것도 매칭되지 않을 때 호출되는 핸들러. 404 처리에 사용한다. */
  readonly onNoMatch?: NoMatchHandler;
}

/** 현재 window.location에서 RouteContext를 생성한다. */
function captureRouteContext(): RouteContext {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

/** baseUrl prefix를 pathname에서 제거한다. */
function stripBaseUrl(pathname: string, baseUrl: string): string {
  if (!baseUrl || baseUrl === '/') return pathname;
  if (pathname.startsWith(baseUrl)) {
    const stripped = pathname.slice(baseUrl.length);
    return stripped === '' ? '/' : stripped;
  }
  return pathname;
}

/**
 * URL 변경을 감지하여 적절한 MFE를 mount/unmount하는 라우터.
 * History API의 popstate, pushState, replaceState를 모두 감시한다.
 * 라우트 가드를 통해 네비게이션을 제어할 수 있다.
 */
export class Router {
  private readonly registry: RouterRegistry;
  private readonly mode: 'history' | 'hash';
  private readonly baseUrl: string;
  private readonly onNoMatch: NoMatchHandler | undefined;
  private started = false;
  private readonly boundHandleRouteChange: () => void;
  private readonly beforeGuards: BeforeRouteChangeGuard[] = [];
  private readonly afterGuards: AfterRouteChangeGuard[] = [];
  private previousRoute: RouteContext = { pathname: '', search: '', hash: '' };
  private originalReplaceState: History['replaceState'] = history.replaceState.bind(history);
  /** 패치 전 원본 pushState — stop() 시 복원용 */
  private savedPushState: History['pushState'] | undefined;
  /** 패치 전 원본 replaceState — stop() 시 복원용 */
  private savedReplaceState: History['replaceState'] | undefined;
  /** 네비게이션 버전 — 빠른 연속 네비게이션 시 이전 작업을 무효화한다 */
  private navigationVersion = 0;

  constructor(registry: RouterRegistry, options?: RouterOptions) {
    this.registry = registry;
    this.mode = options?.mode ?? 'history';
    this.baseUrl = normalizeBaseUrl(options?.baseUrl ?? '');
    this.onNoMatch = options?.onNoMatch;
    this.boundHandleRouteChange = () => {
      void this.handleRouteChange();
    };
  }

  /** 라우터를 시작한다. URL 변경 감시를 시작하고 현재 URL에 맞는 앱을 마운트한다. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.previousRoute = captureRouteContext();

    this.patchHistoryApi();

    const eventName = this.mode === 'hash' ? 'hashchange' : 'popstate';
    window.addEventListener(eventName, this.boundHandleRouteChange);
    window.addEventListener('esmap:navigate', this.boundHandleRouteChange);

    await this.handleRouteChange();
  }

  /** 라우터를 정지하고 History API 패치를 복원한다. */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    const eventName = this.mode === 'hash' ? 'hashchange' : 'popstate';
    window.removeEventListener(eventName, this.boundHandleRouteChange);
    window.removeEventListener('esmap:navigate', this.boundHandleRouteChange);

    this.restoreHistoryApi();
  }

  /**
   * 프로그래매틱 네비게이션 — 새 URL로 이동한다 (history.pushState).
   * baseUrl이 설정되어 있으면 자동으로 prefix를 추가한다.
   * @param url - 이동할 경로 (예: "/settings", "/users?tab=all")
   */
  push(url: string): void {
    const fullUrl = this.resolveUrl(url);
    history.pushState(null, '', fullUrl);
  }

  /**
   * 프로그래매틱 네비게이션 — 현재 URL을 교체한다 (history.replaceState).
   * baseUrl이 설정되어 있으면 자동으로 prefix를 추가한다.
   * @param url - 교체할 경로
   */
  replace(url: string): void {
    const fullUrl = this.resolveUrl(url);
    history.replaceState(null, '', fullUrl);
  }

  /** 히스토리 뒤로 이동한다. */
  back(): void {
    history.back();
  }

  /** 히스토리 앞으로 이동한다. */
  forward(): void {
    history.forward();
  }

  /**
   * 히스토리를 delta만큼 이동한다.
   * @param delta - 양수면 앞으로, 음수면 뒤로
   */
  go(delta: number): void {
    history.go(delta);
  }

  /** 현재 라우트 컨텍스트를 반환한다. */
  get currentRoute(): RouteContext {
    return captureRouteContext();
  }

  /**
   * 라우트 변경 전 가드를 등록한다. 해제 함수를 반환한다.
   * @param guard - false를 반환하면 네비게이션이 취소되는 가드 함수
   * @returns 가드 해제 함수
   */
  beforeRouteChange(guard: BeforeRouteChangeGuard): () => void {
    this.beforeGuards.push(guard);
    return () => {
      const idx = this.beforeGuards.indexOf(guard);
      if (idx >= 0) this.beforeGuards.splice(idx, 1);
    };
  }

  /**
   * 라우트 변경 후 가드를 등록한다. 해제 함수를 반환한다.
   * @param guard - mount/unmount 완료 후 실행되는 가드 함수
   * @returns 가드 해제 함수
   */
  afterRouteChange(guard: AfterRouteChangeGuard): () => void {
    this.afterGuards.push(guard);
    return () => {
      const idx = this.afterGuards.indexOf(guard);
      if (idx >= 0) this.afterGuards.splice(idx, 1);
    };
  }

  /**
   * 등록된 모든 beforeRouteChange 가드를 실행한다.
   * @param from - 이전 라우트 컨텍스트
   * @param to - 다음 라우트 컨텍스트
   * @returns 모든 가드가 true를 반환하면 true, 하나라도 false를 반환하면 false
   */
  private async runBeforeGuards(from: RouteContext, to: RouteContext): Promise<boolean> {
    for (const guard of this.beforeGuards) {
      const result = await guard(from, to);
      if (!result) {
        return false;
      }
    }
    return true;
  }

  /**
   * 등록된 모든 afterRouteChange 가드를 실행한다.
   * @param from - 이전 라우트 컨텍스트
   * @param to - 현재 라우트 컨텍스트
   */
  private async runAfterGuards(from: RouteContext, to: RouteContext): Promise<void> {
    for (const guard of this.afterGuards) {
      await guard(from, to);
    }
  }

  /**
   * 현재 URL에 맞는 앱을 찾아 mount하고, 비활성 앱을 unmount한다.
   * navigationVersion으로 빠른 연속 네비게이션 시 이전 작업을 무효화한다.
   */
  private async handleRouteChange(): Promise<void> {
    this.navigationVersion++;
    const version = this.navigationVersion;

    const from = this.previousRoute;
    const to = captureRouteContext();

    const allowed = await this.runBeforeGuards(from, to);
    if (!allowed) {
      this.originalReplaceState(null, '', `${from.pathname}${from.search}${from.hash}`);
      return;
    }

    // 가드 실행 중 새 네비게이션이 발생했으면 이전 작업을 무효화한다
    if (version !== this.navigationVersion) return;

    const apps = this.registry.getApps();
    const effectiveLocation = this.createEffectiveLocation();

    const toMount: RegisteredApp[] = [];
    const toUnmount: RegisteredApp[] = [];

    for (const app of apps) {
      const shouldBeActive = app.activeWhen(effectiveLocation);

      if (shouldBeActive && app.status !== 'MOUNTED') {
        toMount.push(app);
      } else if (!shouldBeActive && app.status === 'MOUNTED') {
        toUnmount.push(app);
      }
    }

    // 어떤 앱도 활성화되지 않고 마운트할 앱도 없으면 404 핸들러 호출
    if (this.onNoMatch && toMount.length === 0) {
      const hasAnyActive = apps.some(
        (app) => app.activeWhen(effectiveLocation) && app.status === 'MOUNTED',
      );
      if (!hasAnyActive) {
        this.onNoMatch(to);
      }
    }

    const unmountPromises = toUnmount.map((app) => this.registry.unmountApp(app.name));
    await Promise.all(unmountPromises);

    // unmount 완료 후 새 네비게이션이 발생했으면 mount를 건너뛴다
    if (version !== this.navigationVersion) return;

    await Promise.all(toMount.map((app) => this.registry.mountApp(app.name)));

    // mount 완료 후에도 최신 네비게이션인지 확인한다
    if (version !== this.navigationVersion) return;

    this.previousRoute = to;

    await this.runAfterGuards(from, to);
  }

  /**
   * pushState/replaceState를 패치하여 커스텀 이벤트를 발생시킨다.
   * popstate만으로는 프로그래매틱 네비게이션을 감지할 수 없기 때문.
   * 원본 메서드를 저장하여 stop() 시 복원한다.
   */
  private patchHistoryApi(): void {
    this.savedPushState = history.pushState.bind(history);
    this.savedReplaceState = history.replaceState.bind(history);

    const originalPushState = this.savedPushState;
    const originalReplaceState = this.savedReplaceState;
    this.originalReplaceState = originalReplaceState;

    history.pushState = (...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      window.dispatchEvent(new CustomEvent('esmap:navigate'));
    };

    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      window.dispatchEvent(new CustomEvent('esmap:navigate'));
    };
  }

  /**
   * baseUrl을 고려하여 실제 URL을 생성한다.
   * @param url - 상대 경로
   * @returns baseUrl이 prefix된 전체 경로
   */
  private resolveUrl(url: string): string {
    if (!this.baseUrl || this.baseUrl === '/') return url;
    // 이미 baseUrl prefix가 있으면 그대로 사용
    if (url.startsWith(this.baseUrl)) return url;
    return `${this.baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  /**
   * baseUrl이 제거된 가상 Location 객체를 생성한다.
   * activeWhen 함수에 baseUrl을 의식하지 않은 pathname이 전달되도록 한다.
   */
  private createEffectiveLocation(): Location {
    if (!this.baseUrl || this.baseUrl === '/') return window.location;
    const strippedPathname = stripBaseUrl(window.location.pathname, this.baseUrl);
    // Proxy로 Location을 감싸서 pathname만 오버라이드한다
    return new Proxy(window.location, {
      get(target, prop) {
        if (prop === 'pathname') return strippedPathname;
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  /** 패치된 History API를 원본으로 복원한다. */
  private restoreHistoryApi(): void {
    if (this.savedPushState) {
      history.pushState = this.savedPushState;
    }
    if (this.savedReplaceState) {
      history.replaceState = this.savedReplaceState;
    }
    this.savedPushState = undefined;
    this.savedReplaceState = undefined;
  }
}

/** baseUrl 끝의 슬래시를 제거하여 정규화한다. */
function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl || baseUrl === '/') return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}
