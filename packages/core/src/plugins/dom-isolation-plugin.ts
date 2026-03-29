/**
 * DOM 쿼리 격리 플러그인.
 * 앱 mount 시 document의 쿼리 메서드를 앱 컨테이너로 스코핑하고,
 * unmount 시 원본으로 복원한다.
 * micro-app(JD.com)의 Element Isolation 패턴에서 영감을 받았다.
 */

import { createDomIsolation } from '@esmap/sandbox';
import type { DomIsolationHandle } from '@esmap/sandbox';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** DOM 격리 플러그인 옵션 */
export interface DomIsolationPluginOptions {
  /**
   * DOM 격리를 적용하지 않을 앱 이름 목록.
   * 글로벌 네비게이션 등 document 전체 접근이 필요한 앱에 사용한다.
   */
  readonly exclude?: readonly string[];
  /**
   * 글로벌 셀렉터 패턴. 이 패턴에 매칭되는 쿼리는 컨테이너 격리를 우회한다.
   * 예: ['#global-modal', '[data-esmap-global]']
   */
  readonly globalSelectors?: readonly string[];
}

/**
 * DOM 쿼리 격리 플러그인을 생성한다.
 * 앱 mount 시 document.querySelector 등을 앱 컨테이너로 스코핑한다.
 *
 * @param options - DOM 격리 플러그인 옵션
 * @returns EsmapPlugin 인스턴스
 */
export function domIsolationPlugin(options: DomIsolationPluginOptions = {}): EsmapPlugin {
  const { exclude = [], globalSelectors = [] } = options;
  const excludeSet = new Set(exclude);

  return {
    name: 'esmap:dom-isolation',

    install(ctx: PluginContext): PluginCleanup {
      const handles = new Map<string, DomIsolationHandle>();

      ctx.hooks.afterEach('mount', (hookCtx) => {
        const appName = hookCtx.appName;
        if (excludeSet.has(appName)) return;

        const app = ctx.registry.getApp(appName);
        if (!app) return;

        const container = document.querySelector<HTMLElement>(app.container);
        if (!container) return;

        const handle = createDomIsolation({
          name: appName,
          container,
          globalSelectors,
        });
        handles.set(appName, handle);
      });

      ctx.hooks.beforeEach('unmount', (hookCtx) => {
        const appName = hookCtx.appName;
        const handle = handles.get(appName);
        if (!handle) return;

        handle.dispose();
        handles.delete(appName);
      });

      return () => {
        for (const [, handle] of handles) {
          handle.dispose();
        }
        handles.clear();
      };
    },
  };
}
