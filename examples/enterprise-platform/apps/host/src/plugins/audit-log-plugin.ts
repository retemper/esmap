/**
 * 감사 로그 커스텀 플러그인.
 * 앱 라이프사이클 이벤트를 구조화된 로그로 수집하고,
 * 외부 시스템(Sentry, DataDog 등)으로 전송할 수 있는 확장 포인트를 제공한다.
 *
 * 시연 포인트:
 * - esmap 플러그인 인터페이스(EsmapPlugin)를 직접 구현하는 방법
 * - PluginContext를 통한 registry, router, hooks, perf 접근
 * - 플러그인 정리(cleanup) 패턴
 */

import type { EsmapPlugin, PluginContext, PluginCleanup } from '@esmap/core';

/** 감사 로그 엔트리 */
interface AuditLogEntry {
  readonly timestamp: number;
  readonly type: 'mount' | 'unmount' | 'route' | 'error';
  readonly appName: string;
  readonly detail: string;
}

/** 감사 로그 플러그인 옵션 */
interface AuditLogPluginOptions {
  /** 최대 보관 엔트리 수 */
  readonly maxEntries?: number;
  /** 로그 발생 시 외부 전송 콜백 */
  readonly onLog?: (entry: AuditLogEntry) => void;
}

/** 감사 로그 플러그인 반환값 */
interface AuditLogPluginResult {
  /** 설치할 플러그인 */
  readonly plugin: EsmapPlugin;
  /** 수집된 로그를 조회하는 접근자 */
  readonly getEntries: () => readonly AuditLogEntry[];
}

/**
 * 앱 라이프사이클을 추적하는 감사 로그 플러그인을 생성한다.
 * communicationPlugin과 동일한 { plugin, accessor } 패턴을 따른다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인과 로그 접근자
 */
export function auditLogPlugin(
  options: AuditLogPluginOptions = {},
): AuditLogPluginResult {
  const { maxEntries = 200, onLog } = options;
  const entries: AuditLogEntry[] = [];

  /** 엔트리를 추가하고 최대 수를 초과하면 오래된 것을 제거한다 */
  function addEntry(entry: AuditLogEntry): void {
    entries.push(entry);
    while (entries.length > maxEntries) {
      entries.shift();
    }
    onLog?.(entry);
  }

  const plugin: EsmapPlugin = {
    name: 'enterprise:audit-log',

    install(ctx: PluginContext): PluginCleanup {
      // 마운트/언마운트 추적
      ctx.hooks.afterEach('mount', (hookCtx) => {
        addEntry({
          timestamp: Date.now(),
          type: 'mount',
          appName: hookCtx.appName,
          detail: `마운트 완료`,
        });
      });

      ctx.hooks.afterEach('unmount', (hookCtx) => {
        addEntry({
          timestamp: Date.now(),
          type: 'unmount',
          appName: hookCtx.appName,
          detail: `언마운트 완료`,
        });
      });

      // 라우트 변경 추적
      const removeRouteGuard = ctx.router.afterRouteChange((_from, to) => {
        const activeApps = ctx.registry.getApps().filter((app) => app.status === 'MOUNTED');
        addEntry({
          timestamp: Date.now(),
          type: 'route',
          appName: activeApps[0]?.name ?? 'unknown',
          detail: `라우트: ${to.pathname}`,
        });
      });

      // 앱 로드 에러 추적
      const removeStatusListener = ctx.registry.onStatusChange((event) => {
        if (event.to === 'LOAD_ERROR') {
          addEntry({
            timestamp: Date.now(),
            type: 'error',
            appName: event.appName,
            detail: `상태 에러: ${event.to}`,
          });
        }
      });

      return () => {
        removeRouteGuard();
        removeStatusListener();
        entries.length = 0;
      };
    },
  };

  return {
    plugin,
    getEntries: () => [...entries],
  };
}
