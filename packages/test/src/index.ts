export { createMockApp, createFailingApp } from './mock-app.js';
export type { MockMfeApp, MockAppOverrides, LifecycleSpy, SpyCall } from './mock-app.js';

export { createTestRegistry } from './mock-registry.js';
export type { TestRegistry, TestRegistryOptions, InlineAppDefinition } from './mock-registry.js';

export { createTestHarness } from './test-harness.js';
export type { TestHarness, TestHarnessOptions } from './test-harness.js';

export { isAppMounted, isAppInStatus, getAppContainer, waitForAppStatus } from './matchers.js';
