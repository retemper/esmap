import { describe, it, expect } from 'vitest';
import { createTestRegistry } from './mock-registry.js';
import { createMockApp } from './mock-app.js';

describe('createTestRegistry', () => {
  it('빈 레지스트리를 생성한다', () => {
    const { registry } = createTestRegistry();

    expect(registry.getApps()).toStrictEqual([]);
  });

  it('인라인 앱 정의로 초기 앱을 등록한다', () => {
    const mockApp = createMockApp();
    const { registry } = createTestRegistry({
      apps: [
        {
          name: '@test/app-a',
          activeWhen: '/app-a',
          app: mockApp,
        },
      ],
    });

    const registered = registry.getApp('@test/app-a');
    expect(registered).toBeDefined();
    expect(registered?.status).toBe('NOT_MOUNTED');
    expect(registered?.app).toBe(mockApp);
  });

  it('여러 인라인 앱을 동시에 등록한다', () => {
    const { registry } = createTestRegistry({
      apps: [
        { name: '@test/app-a', activeWhen: '/a', app: createMockApp() },
        { name: '@test/app-b', activeWhen: '/b', app: createMockApp() },
      ],
    });

    expect(registry.getApps()).toHaveLength(2);
  });

  it('인라인 앱은 이미 NOT_MOUNTED 상태이므로 바로 마운트할 수 있다', async () => {
    const container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);

    const mockApp = createMockApp();
    const { registry } = createTestRegistry({
      apps: [{ name: '@test/direct', activeWhen: '/direct', app: mockApp }],
    });

    await registry.mountApp('@test/direct');

    expect(registry.getApp('@test/direct')?.status).toBe('MOUNTED');
    expect(mockApp.mountSpy.callCount).toBe(1);

    container.remove();
  });
});

describe('registerMockApp', () => {
  it('mock 앱을 이름만으로 간편히 등록한다', () => {
    const { registry, registerMockApp } = createTestRegistry();

    const mockApp = registerMockApp('checkout');

    const registered = registry.getApp('checkout');
    expect(registered).toBeDefined();
    expect(registered?.status).toBe('NOT_MOUNTED');
    expect(mockApp.bootstrapSpy).toBeDefined();
  });

  it('기본 activeWhen 경로는 앱 이름 기반이다', () => {
    const { registry, registerMockApp } = createTestRegistry();

    registerMockApp('dashboard');

    const registered = registry.getApp('dashboard');
    expect(registered?.activeWhen({ pathname: '/dashboard' } as Location)).toBe(true);
    expect(registered?.activeWhen({ pathname: '/other' } as Location)).toBe(false);
  });

  it('커스텀 activeWhen과 container를 지정할 수 있다', () => {
    const { registry, registerMockApp } = createTestRegistry();

    registerMockApp('settings', { activeWhen: '/my-settings', container: '#settings-root' });

    const registered = registry.getApp('settings');
    expect(registered?.activeWhen({ pathname: '/my-settings/profile' } as Location)).toBe(true);
    expect(registered?.container).toBe('#settings-root');
  });

  it('반환된 mock 앱의 라이프사이클 오버라이드가 적용된다', async () => {
    const records: string[] = [];
    const { registerMockApp } = createTestRegistry();

    const mockApp = registerMockApp('custom', {
      bootstrap: async () => {
        records.push('custom-bootstrap');
      },
    });

    await mockApp.bootstrap();

    expect(records).toStrictEqual(['custom-bootstrap']);
  });
});
