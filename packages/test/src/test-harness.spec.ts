import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness } from './test-harness.js';
import { createMockApp } from './mock-app.js';
import type { TestHarness } from './test-harness.js';

/** Reference for cleaning up harnesses between tests */
const harnesses: TestHarness[] = [];

afterEach(async () => {
  for (const harness of harnesses) {
    await harness.cleanup();
  }
  harnesses.length = 0;
});

/**
 * Creates a harness and registers it in the cleanup list.
 * @param options - harness options
 */
async function setupHarness(
  options?: Parameters<typeof createTestHarness>[0],
): Promise<TestHarness> {
  const harness = await createTestHarness(options);
  harnesses.push(harness);
  return harness;
}

describe('createTestHarness', () => {
  it('creates a DOM container', async () => {
    const harness = await setupHarness();

    expect(harness.container).toBeInstanceOf(HTMLElement);
    expect(harness.container.id).toBe('app');
    expect(document.querySelector('#app')).toBe(harness.container);
  });

  it('supports custom container selectors', async () => {
    const harness = await setupHarness({ containerSelector: '#custom-root' });

    expect(harness.container.id).toBe('custom-root');
    expect(document.querySelector('#custom-root')).toBe(harness.container);
  });

  it('registers initial apps and reflects them in the registry', async () => {
    const mockApp = createMockApp();
    const harness = await setupHarness({
      apps: [{ name: '@test/nav', activeWhen: '/nav', app: mockApp }],
    });

    const registered = harness.testRegistry.registry.getApp('@test/nav');
    expect(registered).toBeDefined();
    expect(registered?.status).toBe('NOT_MOUNTED');
  });
});

describe('navigate', () => {
  it('changes the path and mounts the matching app', async () => {
    const mockApp = createMockApp();
    const harness = await setupHarness({
      apps: [{ name: '@test/users', activeWhen: '/users', app: mockApp }],
    });

    const mountCountBefore = mockApp.mountSpy.callCount;
    await harness.navigate('/users');

    expect(mockApp.mountSpy.callCount - mountCountBefore).toBeGreaterThanOrEqual(1);
  });

  it('unmounts the app when navigating to an inactive path', async () => {
    const mockApp = createMockApp();
    const harness = await setupHarness({
      apps: [{ name: '@test/users', activeWhen: '/users', app: mockApp }],
    });

    await harness.navigate('/users');
    const unmountCountBefore = mockApp.unmountSpy.callCount;

    await harness.navigate('/other');
    expect(mockApp.unmountSpy.callCount - unmountCountBefore).toBeGreaterThanOrEqual(1);
  });
});

describe('getActiveApps', () => {
  it('returns the list of apps currently in MOUNTED status', async () => {
    const harness = await setupHarness({
      apps: [
        { name: '@test/a', activeWhen: '/a', app: createMockApp() },
        { name: '@test/b', activeWhen: '/b', app: createMockApp() },
      ],
    });

    await harness.navigate('/a');
    const activeApps = harness.getActiveApps();

    expect(activeApps).toHaveLength(1);
    expect(activeApps[0].name).toBe('@test/a');
  });

  it('returns an empty array when no apps are mounted', async () => {
    const harness = await setupHarness({
      apps: [{ name: '@test/x', activeWhen: '/x', app: createMockApp() }],
    });

    await harness.navigate('/no-match');

    expect(harness.getActiveApps()).toStrictEqual([]);
  });
});

describe('cleanup', () => {
  it('removes the DOM container', async () => {
    const harness = await createTestHarness();

    await harness.cleanup();

    expect(document.querySelector('#app')).toBeNull();
  });

  it('unmounts mounted apps', async () => {
    const mockApp = createMockApp();
    const harness = await createTestHarness({
      apps: [{ name: '@test/cleanup', activeWhen: '/cleanup', app: mockApp }],
    });

    const mountCountBefore = mockApp.mountSpy.callCount;
    await harness.navigate('/cleanup');
    expect(mockApp.mountSpy.callCount - mountCountBefore).toBeGreaterThanOrEqual(1);

    const unmountCountBefore = mockApp.unmountSpy.callCount;
    await harness.cleanup();
    expect(mockApp.unmountSpy.callCount - unmountCountBefore).toBeGreaterThanOrEqual(1);
  });
});
