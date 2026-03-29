import type { MfeAppStatus } from '@esmap/shared';
import type { AppRegistry } from '@esmap/runtime';

/**
 * 지정한 앱이 현재 MOUNTED 상태인지 확인한다.
 * @param registry - 앱 레지스트리
 * @param appName - 확인할 앱 이름
 */
export function isAppMounted(registry: AppRegistry, appName: string): boolean {
  const app = registry.getApp(appName);
  return app?.status === 'MOUNTED';
}

/**
 * 지정한 앱이 특정 상태인지 확인한다.
 * @param registry - 앱 레지스트리
 * @param appName - 확인할 앱 이름
 * @param status - 기대하는 상태
 */
export function isAppInStatus(
  registry: AppRegistry,
  appName: string,
  status: MfeAppStatus,
): boolean {
  const app = registry.getApp(appName);
  return app?.status === status;
}

/**
 * 주어진 CSS 셀렉터로 DOM에서 앱 컨테이너를 조회한다.
 * @param selector - CSS 셀렉터
 */
export function getAppContainer(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

/** waitForAppStatus의 기본 타임아웃 (밀리초) */
const DEFAULT_TIMEOUT_MS = 3000;

/** 폴링 간격 (밀리초) */
const POLL_INTERVAL_MS = 50;

/**
 * 앱이 특정 상태에 도달할 때까지 폴링한다.
 * 타임아웃이 초과되면 에러를 던진다.
 * @param registry - 앱 레지스트리
 * @param appName - 대기할 앱 이름
 * @param status - 기대하는 상태
 * @param timeout - 최대 대기 시간 (밀리초, 기본값: 3000)
 */
export async function waitForAppStatus(
  registry: AppRegistry,
  appName: string,
  status: MfeAppStatus,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const startTime = Date.now();

  const poll = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const check = (): void => {
        const app = registry.getApp(appName);
        if (app?.status === status) {
          resolve();
          return;
        }

        if (Date.now() - startTime >= timeout) {
          const currentStatus = app?.status ?? 'NOT_REGISTERED';
          reject(
            new Error(
              `앱 "${appName}"이 ${timeout}ms 내에 "${status}" 상태에 도달하지 못했습니다. 현재 상태: "${currentStatus}"`,
            ),
          );
          return;
        }

        setTimeout(check, POLL_INTERVAL_MS);
      };

      check();
    });

  return poll();
}
