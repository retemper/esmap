/**
 * 지능형 프리페치 플러그인.
 * 라우터의 네비게이션 이벤트를 자동으로 기록하고,
 * 현재 앱에서 다음에 방문할 확률이 높은 앱을 자동 프리페치한다.
 * Garfish(ByteDance)의 intelligent preloading에서 영감을 받았다.
 */

import { createIntelligentPrefetch } from '@esmap/runtime';
import type { IntelligentPrefetchOptions, IntelligentPrefetchController } from '@esmap/runtime';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** 지능형 프리페치 플러그인 옵션 */
export interface IntelligentPrefetchPluginOptions extends IntelligentPrefetchOptions {
  /**
   * 네비게이션 후 프리페치 지연 시간 (ms).
   * 현재 앱이 안정화된 후 프리페치를 시작한다.
   * 기본값 1000.
   */
  readonly prefetchDelay?: number;
  /**
   * 프리페치 대상에서 제외할 컨테이너 셀렉터 목록.
   * 이 컨테이너에 마운트된 앱은 "현재 앱" 판별에서 무시된다.
   * 기본값 [].
   */
  readonly excludeContainers?: readonly string[];
}

/** 지능형 프리페치 플러그인 반환값 */
export interface IntelligentPrefetchPluginResult {
  /** 설치할 플러그인 */
  readonly plugin: EsmapPlugin;
  /** 외부에서 접근할 수 있는 컨트롤러 */
  readonly controller: IntelligentPrefetchController;
}

/** 기본 프리페치 지연 시간 */
const DEFAULT_PREFETCH_DELAY = 1000;

/**
 * 지능형 프리페치 플러그인을 생성한다.
 * communicationPlugin처럼 { plugin, controller } 패턴으로 반환하여
 * 외부에서 학습 데이터에 접근할 수 있게 한다.
 *
 * @param options - 지능형 프리페치 플러그인 옵션
 * @returns 플러그인과 컨트롤러
 */
export function intelligentPrefetchPlugin(
  options: IntelligentPrefetchPluginOptions = {},
): IntelligentPrefetchPluginResult {
  const { prefetchDelay = DEFAULT_PREFETCH_DELAY, excludeContainers = [], ...prefetchOptions } = options;
  const controller = createIntelligentPrefetch(prefetchOptions);

  const plugin: EsmapPlugin = {
    name: 'esmap:intelligent-prefetch',

    install(ctx: PluginContext): PluginCleanup {
      const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

      // 라우트 변경 후 네비게이션을 기록하고 예측 프리페치 실행
      const removeAfterGuard = ctx.router.afterRouteChange((_from, to) => {
        // 현재 활성 앱 찾기 (제외 컨테이너에 마운트된 앱은 무시)
        const activeApps = ctx.registry.getApps().filter((app) => app.status === 'MOUNTED');
        const currentAppName = activeApps.find(
          (app) => !excludeContainers.includes(app.container),
        )?.name;
        const previousAppName = _from.pathname !== to.pathname ? undefined : currentAppName;

        if (currentAppName) {
          controller.recordNavigation(previousAppName, currentAppName);
        }

        // 지연 후 예측 프리페치 실행
        const timeout = setTimeout(() => {
          if (!currentAppName) return;

          const priorities = controller.getPriorities(currentAppName);
          for (const priority of priorities) {
            const prefetchedApps = ctx.prefetch.getPrefetchedApps();
            if (prefetchedApps.includes(priority.appName)) continue;

            // 미로드 앱만 프리페치 — import map에서 URL을 해석한다
            const app = ctx.registry.getApp(priority.appName);
            if (app && app.status === 'NOT_LOADED') {
              ctx.prefetch.prefetchByName(priority.appName);
            }
          }
        }, prefetchDelay);

        pendingTimeouts.push(timeout);
      });

      // 앱 상태 변경으로도 네비게이션 추적
      const removeStatusListener = ctx.registry.onStatusChange((event) => {
        if (event.to === 'MOUNTED') {
          // 이전 MOUNTED 앱을 찾아서 전환 기록
          const mountedApps = ctx.registry
            .getApps()
            .filter((app) => app.status === 'MOUNTED' && app.name !== event.appName);

          const previousApp = mountedApps.find(
            (app) => !excludeContainers.includes(app.container),
          );
          controller.recordNavigation(previousApp?.name, event.appName);
        }
      });

      return () => {
        removeAfterGuard();
        removeStatusListener();
        for (const timeout of pendingTimeouts) {
          clearTimeout(timeout);
        }
        pendingTimeouts.length = 0;
        controller.persist();
      };
    },
  };

  return { plugin, controller };
}
