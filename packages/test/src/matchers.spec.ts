import { describe, it, expect, afterEach } from 'vitest';
import { AppRegistry } from '@esmap/runtime';
import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { isAppMounted, isAppInStatus, getAppContainer, waitForAppStatus } from './matchers.js';
import { createMockApp } from './mock-app.js';

/** Injects a test app directly into the registry in NOT_MOUNTED status. */
function registerTestApp(registry: AppRegistry, name: string, app: MfeApp): void {
  registry.registerApp({ name, activeWhen: `/${name}` });
  const registered = registry.getApp(name);
  if (registered) {
    (registered as { status: MfeAppStatus }).status = 'NOT_MOUNTED';
    (registered as { app?: MfeApp }).app = app;
  }
}

describe('isAppMounted', () => {
  it('returns true for an app in MOUNTED status', async () => {
    const container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    const registry = new AppRegistry();
    registerTestApp(registry, 'mounted-app', createMockApp());

    await registry.mountApp('mounted-app');

    expect(isAppMounted(registry, 'mounted-app')).toBe(true);

    container.remove();
  });

  it('returns false for an app in NOT_MOUNTED status', () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'unmounted-app', createMockApp());

    expect(isAppMounted(registry, 'unmounted-app')).toBe(false);
  });

  it('returns false for an unregistered app', () => {
    const registry = new AppRegistry();

    expect(isAppMounted(registry, 'nonexistent')).toBe(false);
  });
});

describe('isAppInStatus', () => {
  it('returns true when the app matches the specified status', () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'status-app', createMockApp());

    expect(isAppInStatus(registry, 'status-app', 'NOT_MOUNTED')).toBe(true);
  });

  it('returns false when the app does not match the specified status', () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'status-app', createMockApp());

    expect(isAppInStatus(registry, 'status-app', 'MOUNTED')).toBe(false);
  });
});

describe('getAppContainer', () => {
  afterEach(() => {
    const el = document.querySelector('#test-container');
    if (el) el.remove();
  });

  it('returns a container that exists in the DOM', () => {
    const el = document.createElement('div');
    el.id = 'test-container';
    document.body.appendChild(el);

    expect(getAppContainer('#test-container')).toBe(el);
  });

  it('returns null for a selector not found in the DOM', () => {
    expect(getAppContainer('#nonexistent')).toBeNull();
  });
});

describe('waitForAppStatus', () => {
  it('resolves immediately if already in the expected status', async () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'ready-app', createMockApp());

    await expect(waitForAppStatus(registry, 'ready-app', 'NOT_MOUNTED')).resolves.toBeUndefined();
  });

  it('throws an error if the status does not change within the timeout', async () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'slow-app', createMockApp());

    await expect(waitForAppStatus(registry, 'slow-app', 'MOUNTED', 100)).rejects.toThrow(
      'within 100ms',
    );
  });

  it('resolves when the status changes asynchronously', async () => {
    const container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    const registry = new AppRegistry();
    registerTestApp(registry, 'async-app', createMockApp());

    setTimeout(() => {
      void registry.mountApp('async-app');
    }, 50);

    await expect(waitForAppStatus(registry, 'async-app', 'MOUNTED', 1000)).resolves.toBeUndefined();

    container.remove();
  });

  it('throws a timeout error for an unregistered app', async () => {
    const registry = new AppRegistry();

    await expect(waitForAppStatus(registry, 'ghost-app', 'MOUNTED', 100)).rejects.toThrow(
      'NOT_REGISTERED',
    );
  });
});
