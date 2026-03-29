/**
 * Keep-alive 플러그인.
 * 지정된 앱의 라우트 전환 시 DOM 상태를 보존하여 재마운트 비용을 제거한다.
 * wujie(Tencent)의 keep-alive 패턴에서 영감을 받았다.
 *
 * 동작 원리:
 * - 언마운트 시: 실제 unmount를 호출하지 않고 컨테이너를 숨긴다 (FROZEN 상태)
 * - 재마운트 시: 컨테이너를 다시 표시하여 즉시 복원한다 (mount 호출 불필요)
 * - 스크롤 위치, 폼 입력값, React 컴포넌트 상태 등이 모두 보존된다
 */

import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** keep-alive 플러그인 옵션 */
export interface KeepAlivePluginOptions {
  /**
   * keep-alive를 적용할 앱 이름 목록.
   * 목록에 포함된 앱은 라우트 전환 시 DOM이 보존된다.
   */
  readonly apps: readonly string[];
  /**
   * 최대 keep-alive 앱 수. 초과 시 가장 오래된 FROZEN 앱을 실제 언마운트한다.
   * 메모리 사용량을 제한하는 데 유용하다. 기본값 Infinity (무제한).
   */
  readonly maxCached?: number;
}

/**
 * Keep-alive 플러그인을 생성한다.
 * 지정된 앱이 라우트 전환 시 DOM 상태를 보존하도록 레지스트리를 설정한다.
 *
 * @param options - keep-alive 플러그인 옵션
 * @returns EsmapPlugin 인스턴스
 */
export function keepAlivePlugin(options: KeepAlivePluginOptions): EsmapPlugin {
  const { apps, maxCached = Infinity } = options;
  /** FROZEN된 앱을 시간순으로 추적하여 LRU 제거에 사용한다 */
  const frozenOrder: string[] = [];

  return {
    name: 'esmap:keep-alive',

    install(ctx: PluginContext): PluginCleanup {
      // 지정된 앱들에 keep-alive 설정
      for (const appName of apps) {
        ctx.registry.setKeepAlive(appName, true);
      }

      // LRU 제거: FROZEN 앱 수가 maxCached를 초과하면 가장 오래된 것을 실제 언마운트
      const removeStatusListener = ctx.registry.onStatusChange((event) => {
        if (event.to === 'FROZEN') {
          // 이미 추적 중이면 제거 후 맨 뒤에 추가 (LRU 갱신)
          const idx = frozenOrder.indexOf(event.appName);
          if (idx >= 0) frozenOrder.splice(idx, 1);
          frozenOrder.push(event.appName);

          // maxCached 초과 시 가장 오래된 FROZEN 앱을 실제 언마운트
          while (frozenOrder.length > maxCached) {
            const evicted = frozenOrder.shift();
            if (evicted === undefined) break;
            ctx.registry.setKeepAlive(evicted, false);

            // FROZEN 상태의 앱을 찾아 실제 언마운트
            const app = ctx.registry.getApp(evicted);
            if (app && app.status === 'FROZEN') {
              // 컨테이너를 다시 보이게 하고 unmount 실행
              const container = document.querySelector<HTMLElement>(app.container);
              if (container) {
                container.style.display = '';
              }
              void ctx.registry.unmountApp(evicted).then(
                () => {
                  // 제거 후 keep-alive 다시 설정 (다음 마운트 시 적용)
                  ctx.registry.setKeepAlive(evicted, true);
                },
                () => {
                  // unmount 실패 시에도 keep-alive 복원
                  ctx.registry.setKeepAlive(evicted, true);
                },
              );
            }
          }
        }

        if (event.to === 'MOUNTED' && event.from === 'FROZEN') {
          // thaw 시 frozenOrder에서 제거
          const idx = frozenOrder.indexOf(event.appName);
          if (idx >= 0) frozenOrder.splice(idx, 1);
        }
      });

      return () => {
        removeStatusListener();
        frozenOrder.length = 0;
        for (const appName of apps) {
          ctx.registry.setKeepAlive(appName, false);
        }
      };
    },
  };
}
