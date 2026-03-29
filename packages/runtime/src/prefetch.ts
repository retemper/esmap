/** 프리페치 전략 */
export type PrefetchStrategy = 'idle' | 'immediate';

/** 프리페치 대상 앱 정보 */
export interface PrefetchAppConfig {
  /** 앱 이름 */
  readonly name: string;
  /** 앱 모듈 URL */
  readonly url: string;
}

/** 프리페치 생성 옵션 */
export interface PrefetchOptions {
  /** 프리페치 전략 */
  readonly strategy: PrefetchStrategy;
  /** 프리페치할 앱 목록 */
  readonly apps: readonly PrefetchAppConfig[];
  /** import map — 이름 기반 프리페치 시 URL을 해석하는 데 사용한다 */
  readonly importMap?: { readonly imports: Readonly<Record<string, string>> };
}

/** 프리페치 컨트롤러 */
export interface PrefetchController {
  /** 프리페치를 시작한다 */
  start(): void;
  /** 프리페치를 중지한다 */
  stop(): void;
  /** 특정 앱을 즉시 프리페치한다 */
  prefetchApp(app: PrefetchAppConfig): void;
  /** 이름으로 앱을 프리페치한다. import map에서 URL을 해석한다. */
  prefetchByName(name: string): void;
  /** 프리페치된 앱 이름 목록을 반환한다 */
  getPrefetchedApps(): readonly string[];
}

/**
 * 스마트 프리로딩 컨트롤러를 생성한다.
 * idle 전략은 requestIdleCallback을, immediate 전략은 즉시 실행을 사용한다.
 * @param options - 프리페치 옵션
 * @returns 프리페치 컨트롤러
 */
export function createPrefetch(options: PrefetchOptions): PrefetchController {
  const prefetched = new Set<string>();
  const pendingCallbacks: number[] = [];
  const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
  const addedLinks = new Set<string>();

  /** modulepreload 링크 태그를 추가한다 */
  function addPreloadLink(url: string): void {
    if (addedLinks.has(url)) return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = url;
    document.head.appendChild(link);
    addedLinks.add(url);
  }

  /**
   * 단일 앱을 프리페치 처리한다. 빈 URL은 무시한다.
   * @param app - 프리페치할 앱 설정
   */
  function doPrefetchApp(app: PrefetchAppConfig): void {
    if (prefetched.has(app.name) || !app.url) return;
    addPreloadLink(app.url);
    prefetched.add(app.name);
  }

  return {
    start(): void {
      const { strategy, apps } = options;

      if (strategy === 'immediate') {
        for (const app of apps) {
          doPrefetchApp(app);
        }
        return;
      }

      /* idle 전략: requestIdleCallback이 있으면 사용, 없으면 setTimeout 폴백 */
      if (typeof requestIdleCallback === 'function') {
        for (const app of apps) {
          const id = requestIdleCallback(() => {
            doPrefetchApp(app);
          });
          pendingCallbacks.push(id);
        }
      } else {
        for (const app of apps) {
          const id = setTimeout(() => {
            doPrefetchApp(app);
          }, 200);
          pendingTimeouts.push(id);
        }
      }
    },

    stop(): void {
      for (const id of pendingCallbacks) {
        cancelIdleCallback(id);
      }
      pendingCallbacks.length = 0;

      for (const id of pendingTimeouts) {
        clearTimeout(id);
      }
      pendingTimeouts.length = 0;
    },

    prefetchApp(app: PrefetchAppConfig): void {
      doPrefetchApp(app);
    },

    prefetchByName(name: string): void {
      const url = options.importMap?.imports[name];
      if (!url) return;
      doPrefetchApp({ name, url });
    },

    getPrefetchedApps(): readonly string[] {
      return Array.from(prefetched);
    },
  };
}
