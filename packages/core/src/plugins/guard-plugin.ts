/**
 * CSS 격리 + 글로벌 오염 감지 플러그인.
 * 앱 mount 시 자동으로 CSS 스코핑과 글로벌 가드를 적용하고,
 * unmount 시 정리한다.
 */

import {
  applyCssScope,
  removeCssScope,
  createStyleIsolation,
  createGlobalGuard,
} from '@esmap/guard';
import type { StyleIsolationHandle, GlobalGuardHandle, CssScopeOptions } from '@esmap/guard';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** guard 플러그인 옵션 */
export interface GuardPluginOptions {
  /** CSS 격리 전략. 기본값 'attribute'. */
  readonly cssStrategy?: 'attribute' | 'shadow';
  /** 동적 스타일 추가를 MutationObserver로 감시할지 여부. 기본값 true. */
  readonly observeDynamic?: boolean;
  /** 글로벌 오염 감지 활성화 여부. 기본값 true. */
  readonly detectGlobalPollution?: boolean;
  /** 글로벌 오염 허용 목록 */
  readonly globalAllowList?: readonly string[];
  /** 글로벌 오염 감지 시 콜백 */
  readonly onGlobalViolation?: (appName: string, property: string) => void;
}

/** 앱별 격리 상태 */
interface AppIsolation {
  readonly styleHandle: StyleIsolationHandle;
  readonly guardHandle: GlobalGuardHandle | null;
}

/**
 * CSS 격리 + 글로벌 오염 감지 플러그인을 생성한다.
 * mount 시 자동으로 CSS 스코핑과 글로벌 가드를 적용하고, unmount 시 정리한다.
 *
 * @param options - guard 플러그인 옵션
 * @returns EsmapPlugin 인스턴스
 */
export function guardPlugin(options: GuardPluginOptions = {}): EsmapPlugin {
  const {
    cssStrategy = 'attribute',
    observeDynamic = true,
    detectGlobalPollution = true,
    globalAllowList = [],
    onGlobalViolation,
  } = options;

  return {
    name: 'esmap:guard',

    install(ctx: PluginContext): PluginCleanup {
      const isolations = new Map<string, AppIsolation>();

      ctx.hooks.afterEach('mount', (hookCtx) => {
        const appName = hookCtx.appName;
        const app = ctx.registry.getApp(appName);
        if (!app) return;

        const container = document.querySelector<HTMLElement>(app.container);
        if (!container) return;

        applyCssScope(container, { prefix: appName } satisfies CssScopeOptions);

        const styleHandle = createStyleIsolation({
          appName,
          container,
          strategy: cssStrategy,
          observeDynamic,
        });

        const guardHandle = detectGlobalPollution
          ? createGlobalGuard({
              allowList: [...globalAllowList],
              onViolation: (violation) => {
                onGlobalViolation?.(appName, violation.property);
              },
            })
          : null;

        isolations.set(appName, { styleHandle, guardHandle });
      });

      ctx.hooks.beforeEach('unmount', (hookCtx) => {
        const appName = hookCtx.appName;
        const isolation = isolations.get(appName);
        if (!isolation) return;

        isolation.styleHandle.destroy();
        isolation.guardHandle?.dispose();

        const app = ctx.registry.getApp(appName);
        if (app) {
          const container = document.querySelector<HTMLElement>(app.container);
          if (container) {
            removeCssScope(container, { prefix: appName });
          }
        }

        isolations.delete(appName);
      });

      return () => {
        for (const [, isolation] of isolations) {
          isolation.styleHandle.destroy();
          isolation.guardHandle?.dispose();
        }
        isolations.clear();
      };
    },
  };
}
