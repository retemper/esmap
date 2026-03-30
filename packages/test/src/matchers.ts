import type { MfeAppStatus } from '@esmap/shared';
import type { AppRegistry } from '@esmap/runtime';

/**
 * Checks whether the specified app is currently in MOUNTED status.
 * @param registry - app registry
 * @param appName - name of the app to check
 */
export function isAppMounted(registry: AppRegistry, appName: string): boolean {
  const app = registry.getApp(appName);
  return app?.status === 'MOUNTED';
}

/**
 * Checks whether the specified app is in a particular status.
 * @param registry - app registry
 * @param appName - name of the app to check
 * @param status - expected status
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
 * Queries the DOM for an app container using the given CSS selector.
 * @param selector - CSS selector
 */
export function getAppContainer(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

/** Default timeout for waitForAppStatus (milliseconds) */
const DEFAULT_TIMEOUT_MS = 3000;

/** Polling interval (milliseconds) */
const POLL_INTERVAL_MS = 50;

/**
 * Polls until an app reaches a specific status.
 * Throws an error if the timeout is exceeded.
 * @param registry - app registry
 * @param appName - name of the app to wait for
 * @param status - expected status
 * @param timeout - maximum wait time (milliseconds, default: 3000)
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
              `App "${appName}" did not reach "${status}" status within ${timeout}ms. Current status: "${currentStatus}"`,
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
