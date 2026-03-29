/**
 * esmap 플러그인 시스템.
 * 프레임워크의 모든 서브시스템에 접근할 수 있는 확장 포인트를 제공한다.
 */

import type { AppRegistry, Router, LifecycleHooks, PrefetchController } from '@esmap/runtime';
import type { PerfTracker } from '@esmap/monitor';

/** 플러그인이 정리 시 실행할 함수 */
export type PluginCleanup = () => void | Promise<void>;

/** 플러그인 install에 전달되는 컨텍스트. 프레임워크의 모든 서브시스템에 접근할 수 있다. */
export interface PluginContext {
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
}

/**
 * esmap 플러그인 인터페이스.
 * install 메서드에서 PluginContext를 받아 프레임워크를 확장한다.
 * 반환된 cleanup 함수는 destroy 시 역순으로 실행된다.
 */
export interface EsmapPlugin {
  /** 플러그인 식별 이름 */
  readonly name: string;
  /**
   * 프레임워크에 플러그인을 설치한다.
   * cleanup 함수를 반환하면 destroy 시 자동으로 호출된다.
   * @param ctx - 프레임워크 서브시스템 접근 컨텍스트
   */
  install(ctx: PluginContext): PluginCleanup | void;
}

/**
 * 플러그인 목록을 순서대로 설치하고, cleanup 함수를 수집한다.
 * @param plugins - 설치할 플러그인 배열
 * @param ctx - 플러그인 컨텍스트
 * @returns cleanup 함수 배열 (install 순서)
 */
export function installPlugins(
  plugins: readonly EsmapPlugin[],
  ctx: PluginContext,
): readonly PluginCleanup[] {
  const cleanups: PluginCleanup[] = [];
  const installed = new Set<string>();

  for (const plugin of plugins) {
    if (installed.has(plugin.name)) {
      throw new Error(`플러그인 "${plugin.name}"이(가) 이미 설치되었습니다`);
    }
    installed.add(plugin.name);

    const cleanup = plugin.install(ctx);
    if (cleanup) {
      cleanups.push(cleanup);
    }
  }

  return cleanups;
}

/**
 * cleanup 함수 배열을 역순으로 실행한다.
 * 설치 순서의 역순으로 정리하여 의존성 문제를 방지한다.
 * @param cleanups - 실행할 cleanup 함수 배열
 */
export async function runCleanups(cleanups: readonly PluginCleanup[]): Promise<void> {
  const reversed = [...cleanups].reverse();
  for (const cleanup of reversed) {
    await cleanup();
  }
}
