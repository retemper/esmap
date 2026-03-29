import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness } from './test-harness.js';
import { createMockApp } from './mock-app.js';
import type { TestHarness } from './test-harness.js';

/** 테스트 간 하네스 정리를 위한 참조 */
const harnesses: TestHarness[] = [];

afterEach(async () => {
  for (const harness of harnesses) {
    await harness.cleanup();
  }
  harnesses.length = 0;
});

/**
 * 하네스를 생성하고 정리 목록에 등록한다.
 * @param options - 하네스 옵션
 */
async function setupHarness(
  options?: Parameters<typeof createTestHarness>[0],
): Promise<TestHarness> {
  const harness = await createTestHarness(options);
  harnesses.push(harness);
  return harness;
}

describe('createTestHarness', () => {
  it('DOM 컨테이너를 생성한다', async () => {
    const harness = await setupHarness();

    expect(harness.container).toBeInstanceOf(HTMLElement);
    expect(harness.container.id).toBe('app');
    expect(document.querySelector('#app')).toBe(harness.container);
  });

  it('커스텀 컨테이너 셀렉터를 지원한다', async () => {
    const harness = await setupHarness({ containerSelector: '#custom-root' });

    expect(harness.container.id).toBe('custom-root');
    expect(document.querySelector('#custom-root')).toBe(harness.container);
  });

  it('초기 앱을 등록하고 레지스트리에 반영한다', async () => {
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
  it('경로를 변경하고 매칭되는 앱을 마운트한다', async () => {
    const mockApp = createMockApp();
    const harness = await setupHarness({
      apps: [{ name: '@test/users', activeWhen: '/users', app: mockApp }],
    });

    const mountCountBefore = mockApp.mountSpy.callCount;
    await harness.navigate('/users');

    expect(mockApp.mountSpy.callCount - mountCountBefore).toBeGreaterThanOrEqual(1);
  });

  it('비활성 경로로 이동하면 앱을 언마운트한다', async () => {
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
  it('현재 MOUNTED 상태인 앱 목록을 반환한다', async () => {
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

  it('마운트된 앱이 없으면 빈 배열을 반환한다', async () => {
    const harness = await setupHarness({
      apps: [{ name: '@test/x', activeWhen: '/x', app: createMockApp() }],
    });

    await harness.navigate('/no-match');

    expect(harness.getActiveApps()).toStrictEqual([]);
  });
});

describe('cleanup', () => {
  it('DOM 컨테이너를 제거한다', async () => {
    const harness = await createTestHarness();

    await harness.cleanup();

    expect(document.querySelector('#app')).toBeNull();
  });

  it('마운트된 앱을 언마운트한다', async () => {
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
