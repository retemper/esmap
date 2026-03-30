import { describe, it, expect } from 'vitest';
import { createTestRegistry } from './mock-registry.js';
import { createMockApp } from './mock-app.js';

describe('createTestRegistry', () => {
  it('creates an empty registry', () => {
    const { registry } = createTestRegistry();

    expect(registry.getApps()).toStrictEqual([]);
  });

  it('registers initial apps with inline app definitions', () => {
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

  it('registers multiple inline apps simultaneously', () => {
    const { registry } = createTestRegistry({
      apps: [
        { name: '@test/app-a', activeWhen: '/a', app: createMockApp() },
        { name: '@test/app-b', activeWhen: '/b', app: createMockApp() },
      ],
    });

    expect(registry.getApps()).toHaveLength(2);
  });

  it('inline apps are already in NOT_MOUNTED status so they can be mounted immediately', async () => {
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
  it('registers a mock app conveniently by name only', () => {
    const { registry, registerMockApp } = createTestRegistry();

    const mockApp = registerMockApp('checkout');

    const registered = registry.getApp('checkout');
    expect(registered).toBeDefined();
    expect(registered?.status).toBe('NOT_MOUNTED');
    expect(mockApp.bootstrapSpy).toBeDefined();
  });

  it('defaults activeWhen path based on the app name', () => {
    const { registry, registerMockApp } = createTestRegistry();

    registerMockApp('dashboard');

    const registered = registry.getApp('dashboard');
    expect(registered?.activeWhen({ pathname: '/dashboard' } as Location)).toBe(true);
    expect(registered?.activeWhen({ pathname: '/other' } as Location)).toBe(false);
  });

  it('supports custom activeWhen and container', () => {
    const { registry, registerMockApp } = createTestRegistry();

    registerMockApp('settings', { activeWhen: '/my-settings', container: '#settings-root' });

    const registered = registry.getApp('settings');
    expect(registered?.activeWhen({ pathname: '/my-settings/profile' } as Location)).toBe(true);
    expect(registered?.container).toBe('#settings-root');
  });

  it('applies lifecycle overrides on the returned mock app', async () => {
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
