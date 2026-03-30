import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { AppRegistry } from '@esmap/runtime';
import { createMockApp } from './mock-app.js';
import type { MockAppOverrides, MockMfeApp } from './mock-app.js';

/** Inline app definition. Injects an MfeApp instance directly without dynamic import. */
export interface InlineAppDefinition {
  /** App name */
  readonly name: string;
  /** Active route matching function or path prefix */
  readonly activeWhen: string | readonly string[] | ((location: Location) => boolean);
  /** DOM selector for the mount target (default: '#app') */
  readonly container?: string;
  /** MfeApp instance to inject directly */
  readonly app: MfeApp;
}

/** Options for createTestRegistry */
export interface TestRegistryOptions {
  /** List of inline apps to register initially */
  readonly apps?: readonly InlineAppDefinition[];
}

/** Test-only AppRegistry wrapper. Allows easy registration of mock apps. */
export interface TestRegistry {
  /** Internal AppRegistry instance */
  readonly registry: AppRegistry;
  /**
   * Registers a mock app conveniently with just a name and overrides.
   * @param name - app name
   * @param overrides - lifecycle method overrides
   * @returns registered MockMfeApp instance
   */
  registerMockApp(
    name: string,
    overrides?: MockAppOverrides & { activeWhen?: string; container?: string },
  ): MockMfeApp;
}

/**
 * Creates a pre-configured AppRegistry suitable for testing.
 * Accepts inline app definitions and injects MfeApp directly without dynamic import.
 * @param options - options including initial app definitions
 */
export function createTestRegistry(options?: TestRegistryOptions): TestRegistry {
  const registry = new AppRegistry();

  /** Registers an inline app in the registry and sets it to loaded status immediately. */
  const injectApp = (definition: InlineAppDefinition): void => {
    registry.registerApp({
      name: definition.name,
      activeWhen: definition.activeWhen,
      container: definition.container,
    });

    const registered = registry.getApp(definition.name);
    if (registered) {
      /**
       * In the test environment, we directly set RegisteredApp's mutable fields
       * to bypass dynamic import.
       */
      (registered as { status: MfeAppStatus }).status = 'NOT_MOUNTED';
      (registered as { app?: MfeApp }).app = definition.app;
    }
  };

  const initialApps = options?.apps ?? [];
  for (const appDef of initialApps) {
    injectApp(appDef);
  }

  const registerMockApp = (
    name: string,
    overrides?: MockAppOverrides & { activeWhen?: string; container?: string },
  ): MockMfeApp => {
    const mockApp = createMockApp(overrides);
    injectApp({
      name,
      activeWhen: overrides?.activeWhen ?? `/${name}`,
      container: overrides?.container,
      app: mockApp,
    });
    return mockApp;
  };

  return {
    registry,
    registerMockApp,
  };
}
