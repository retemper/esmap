import { describe, it, expect, afterEach } from 'vitest';
import { AppRegistry } from '@esmap/runtime';
import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { isAppMounted, isAppInStatus, getAppContainer, waitForAppStatus } from './matchers.js';
import { createMockApp } from './mock-app.js';

/** 테스트 앱을 NOT_MOUNTED 상태로 레지스트리에 직접 주입한다. */
function registerTestApp(registry: AppRegistry, name: string, app: MfeApp): void {
  registry.registerApp({ name, activeWhen: `/${name}` });
  const registered = registry.getApp(name);
  if (registered) {
    (registered as { status: MfeAppStatus }).status = 'NOT_MOUNTED';
    (registered as { app?: MfeApp }).app = app;
  }
}

describe('isAppMounted', () => {
  it('MOUNTED 상태인 앱에 대해 true를 반환한다', async () => {
    const container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    const registry = new AppRegistry();
    registerTestApp(registry, 'mounted-app', createMockApp());

    await registry.mountApp('mounted-app');

    expect(isAppMounted(registry, 'mounted-app')).toBe(true);

    container.remove();
  });

  it('NOT_MOUNTED 상태인 앱에 대해 false를 반환한다', () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'unmounted-app', createMockApp());

    expect(isAppMounted(registry, 'unmounted-app')).toBe(false);
  });

  it('등록되지 않은 앱에 대해 false를 반환한다', () => {
    const registry = new AppRegistry();

    expect(isAppMounted(registry, 'nonexistent')).toBe(false);
  });
});

describe('isAppInStatus', () => {
  it('앱이 지정한 상태와 일치하면 true를 반환한다', () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'status-app', createMockApp());

    expect(isAppInStatus(registry, 'status-app', 'NOT_MOUNTED')).toBe(true);
  });

  it('앱이 지정한 상태와 일치하지 않으면 false를 반환한다', () => {
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

  it('DOM에 존재하는 컨테이너를 반환한다', () => {
    const el = document.createElement('div');
    el.id = 'test-container';
    document.body.appendChild(el);

    expect(getAppContainer('#test-container')).toBe(el);
  });

  it('DOM에 존재하지 않는 셀렉터에 대해 null을 반환한다', () => {
    expect(getAppContainer('#nonexistent')).toBeNull();
  });
});

describe('waitForAppStatus', () => {
  it('이미 해당 상태이면 즉시 resolve한다', async () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'ready-app', createMockApp());

    await expect(waitForAppStatus(registry, 'ready-app', 'NOT_MOUNTED')).resolves.toBeUndefined();
  });

  it('타임아웃 내에 상태가 변경되지 않으면 에러를 던진다', async () => {
    const registry = new AppRegistry();
    registerTestApp(registry, 'slow-app', createMockApp());

    await expect(waitForAppStatus(registry, 'slow-app', 'MOUNTED', 100)).rejects.toThrow(
      '100ms 내에',
    );
  });

  it('비동기적으로 상태가 변경되면 resolve한다', async () => {
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

  it('등록되지 않은 앱에 대해 타임아웃 에러를 던진다', async () => {
    const registry = new AppRegistry();

    await expect(waitForAppStatus(registry, 'ghost-app', 'MOUNTED', 100)).rejects.toThrow(
      'NOT_REGISTERED',
    );
  });
});
