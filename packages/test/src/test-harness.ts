import type { RegisteredApp } from '@esmap/shared';
import { Router } from '@esmap/runtime';
import type { RouterOptions } from '@esmap/runtime';
import { createTestRegistry } from './mock-registry.js';
import type { InlineAppDefinition, TestRegistry } from './mock-registry.js';

/** Options for createTestHarness */
export interface TestHarnessOptions {
  /** List of inline apps to register initially */
  readonly apps?: readonly InlineAppDefinition[];
  /** Router options */
  readonly routerOptions?: RouterOptions;
  /** DOM container selector (default: '#app') */
  readonly containerSelector?: string;
}

/** Full environment harness for MFE integration testing */
export interface TestHarness {
  /** Test registry */
  readonly testRegistry: TestRegistry;
  /** Router instance */
  readonly router: Router;
  /** DOM container element */
  readonly container: HTMLElement;
  /**
   * Performs programmatic navigation to the specified path.
   * @param path - URL path to navigate to
   */
  navigate(path: string): Promise<void>;
  /** Returns the list of currently MOUNTED apps. */
  getActiveApps(): readonly RegisteredApp[];
  /** Cleans up the DOM container, router, and registry. */
  cleanup(): Promise<void>;
}

/**
 * Sets up the DOM container, registry, and router needed for MFE integration testing.
 * Call cleanup() to release all resources.
 * @param options - test harness configuration options
 */
export async function createTestHarness(options?: TestHarnessOptions): Promise<TestHarness> {
  const containerSelector = options?.containerSelector ?? '#app';
  const selectorId = containerSelector.startsWith('#')
    ? containerSelector.slice(1)
    : containerSelector;

  const existingContainer = document.querySelector(containerSelector);
  if (existingContainer) {
    existingContainer.remove();
  }

  const container = document.createElement('div');
  container.id = selectorId;
  document.body.appendChild(container);

  const testRegistry = createTestRegistry({ apps: options?.apps });
  const router = new Router(testRegistry.registry, options?.routerOptions);

  await router.start();

  const navigate = async (path: string): Promise<void> => {
    history.pushState(null, '', path);
    /**
     * The Router patches pushState to emit esmap:navigate events.
     * Since event handling is asynchronous, we yield one microtask.
     */
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  };

  const getActiveApps = (): readonly RegisteredApp[] =>
    testRegistry.registry.getApps().filter((app) => app.status === 'MOUNTED');

  const cleanup = async (): Promise<void> => {
    router.stop();

    const apps = testRegistry.registry.getApps();
    for (const app of apps) {
      if (app.status === 'MOUNTED') {
        await testRegistry.registry.unmountApp(app.name);
      }
    }

    container.remove();
  };

  return {
    testRegistry,
    router,
    container,
    navigate,
    getActiveApps,
    cleanup,
  };
}
