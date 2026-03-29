/**
 * JavaScript 샌드박스 플러그인.
 * 앱 mount 시 ProxySandbox를 자동으로 활성화하고, unmount 시 비활성화한다.
 * window 속성 변경을 앱별로 격리하여 전역 오염을 방지한다.
 */

import { ProxySandbox } from '@esmap/sandbox';
import type { EsmapPlugin, PluginContext, PluginCleanup } from '../plugin.js';

/** sandbox 플러그인 옵션 */
export interface SandboxPluginOptions {
  /** Proxy sandbox의 allowList. 기본값은 ProxySandbox 기본값을 사용한다. */
  readonly allowList?: readonly PropertyKey[];
  /**
   * 샌드박싱을 적용하지 않을 앱 이름 목록.
   * 호스트 앱이나 신뢰된 앱은 제외할 수 있다.
   */
  readonly exclude?: readonly string[];
}

/**
 * JavaScript 샌드박스 플러그인을 생성한다.
 * 앱 mount 시 ProxySandbox를 활성화하고, unmount 시 비활성화한다.
 *
 * @param options - sandbox 플러그인 옵션
 * @returns EsmapPlugin 인스턴스
 */
export function sandboxPlugin(options: SandboxPluginOptions = {}): EsmapPlugin {
  const { allowList, exclude = [] } = options;
  const excludeSet = new Set(exclude);

  return {
    name: 'esmap:sandbox',

    install(ctx: PluginContext): PluginCleanup {
      const sandboxes = new Map<string, ProxySandbox>();

      ctx.hooks.beforeEach('mount', (hookCtx) => {
        const appName = hookCtx.appName;
        if (excludeSet.has(appName)) return;

        const sandbox = new ProxySandbox({ name: appName, allowList });
        sandbox.activate();
        sandboxes.set(appName, sandbox);
      });

      ctx.hooks.afterEach('unmount', (hookCtx) => {
        const appName = hookCtx.appName;
        const sandbox = sandboxes.get(appName);
        if (!sandbox) return;

        sandbox.deactivate();
        sandboxes.delete(appName);
      });

      return () => {
        for (const [, sandbox] of sandboxes) {
          sandbox.deactivate();
        }
        sandboxes.clear();
      };
    },
  };
}
