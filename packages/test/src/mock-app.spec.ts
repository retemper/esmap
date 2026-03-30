import { describe, it, expect } from 'vitest';
import { createMockApp, createFailingApp } from './mock-app.js';

describe('createMockApp', () => {
  it('creates a mock app with default lifecycle methods', async () => {
    const app = createMockApp();

    await app.bootstrap();
    await app.mount(document.createElement('div'));
    await app.unmount(document.createElement('div'));

    expect(app.bootstrapSpy.callCount).toBe(1);
    expect(app.mountSpy.callCount).toBe(1);
    expect(app.unmountSpy.callCount).toBe(1);
  });

  it('tracks update method calls', async () => {
    const app = createMockApp();
    const props = { count: 1 };

    await app.update!(props);

    expect(app.updateSpy.callCount).toBe(1);
    expect(app.updateSpy.calls[0].args[0]).toStrictEqual(props);
  });

  it('includes timestamps in spy call records', async () => {
    const app = createMockApp();
    const before = Date.now();

    await app.bootstrap();

    const after = Date.now();
    const { timestamp } = app.bootstrapSpy.calls[0];

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('resets call records with reset()', async () => {
    const app = createMockApp();

    await app.bootstrap();
    expect(app.bootstrapSpy.callCount).toBe(1);

    app.bootstrapSpy.reset();
    expect(app.bootstrapSpy.callCount).toBe(0);
    expect(app.bootstrapSpy.calls).toStrictEqual([]);
  });

  it('records the container argument on mount call', async () => {
    const app = createMockApp();
    const container = document.createElement('div');

    await app.mount(container);

    expect(app.mountSpy.calls[0].args[0]).toBe(container);
  });

  it('executes custom override functions', async () => {
    const records: string[] = [];
    const app = createMockApp({
      bootstrap: async () => {
        records.push('bootstrapped');
      },
    });

    await app.bootstrap();

    expect(records).toStrictEqual(['bootstrapped']);
    expect(app.bootstrapSpy.callCount).toBe(1);
  });

  it('accumulates call count across multiple calls', async () => {
    const app = createMockApp();
    const container = document.createElement('div');

    await app.mount(container);
    await app.mount(container);
    await app.mount(container);

    expect(app.mountSpy.callCount).toBe(3);
  });
});

describe('createFailingApp', () => {
  it('throws an error at the specified phase', async () => {
    const app = createFailingApp('bootstrap');

    await expect(app.bootstrap()).rejects.toThrow('bootstrap failed');
  });

  it('uses a custom error message', async () => {
    const customError = new Error('custom mount error');
    const app = createFailingApp('mount', customError);
    const container = document.createElement('div');

    await expect(app.mount(container)).rejects.toThrow('custom mount error');
  });

  it('non-failing phases work normally', async () => {
    const app = createFailingApp('unmount');

    await expect(app.bootstrap()).resolves.toBeUndefined();
    await expect(app.mount(document.createElement('div'))).resolves.toBeUndefined();
  });

  it('supports failure at the update phase', async () => {
    const app = createFailingApp('update');
    const props = { key: 'value' };

    await expect(app.update!(props)).rejects.toThrow('update failed');
  });

  it('tracks spy calls even for failing apps', async () => {
    const app = createFailingApp('bootstrap');

    await app.bootstrap().catch(() => {});

    expect(app.bootstrapSpy.callCount).toBe(1);
  });
});
