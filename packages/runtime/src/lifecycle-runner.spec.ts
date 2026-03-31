import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLifecycleRunner } from './lifecycle-runner.js';
import type { MfeApp } from '@esmap/shared';

/** Creates a mock MfeApp for testing */
function createMockApp(options?: { withUpdate?: boolean }): MfeApp {
  const app: MfeApp = {
    bootstrap: vi.fn().mockResolvedValue(undefined),
    mount: vi.fn().mockResolvedValue(undefined),
    unmount: vi.fn().mockResolvedValue(undefined),
  };

  if (options?.withUpdate) {
    app.update = vi.fn().mockResolvedValue(undefined);
  }

  return app;
}

describe('createLifecycleRunner', () => {
  const container = document.createElement('div');

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  describe('initial state', () => {
    it('starts with NOT_LOADED status', () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      expect(runner.status).toBe('NOT_LOADED');
    });
  });

  describe('bootstrap', () => {
    it('transitions from NOT_LOADED to NOT_MOUNTED', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();

      expect(app.bootstrap).toHaveBeenCalledOnce();
      expect(runner.status).toBe('NOT_MOUNTED');
    });

    it('ignores when already bootstrapped', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.bootstrap();

      expect(app.bootstrap).toHaveBeenCalledOnce();
    });

    it('transitions to LOAD_ERROR and throws on failure', async () => {
      const app = createMockApp();
      vi.mocked(app.bootstrap).mockRejectedValue(new Error('bootstrap failed'));
      const runner = createLifecycleRunner({ app, container });

      await expect(runner.bootstrap()).rejects.toThrow('bootstrap failed');
      expect(runner.status).toBe('LOAD_ERROR');
    });

    it('calls the status change callback', async () => {
      const app = createMockApp();
      const onStatusChange = vi.fn();
      const runner = createLifecycleRunner({ app, container, onStatusChange });

      await runner.bootstrap();

      expect(onStatusChange).toHaveBeenCalledWith('NOT_LOADED', 'BOOTSTRAPPING');
      expect(onStatusChange).toHaveBeenCalledWith('BOOTSTRAPPING', 'NOT_MOUNTED');
    });
  });

  describe('mount', () => {
    it('transitions from NOT_MOUNTED to MOUNTED', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();

      expect(app.mount).toHaveBeenCalledWith(container);
      expect(runner.status).toBe('MOUNTED');
    });

    it('throws when called in a state other than NOT_MOUNTED', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await expect(runner.mount()).rejects.toThrow('Cannot mount in current state');
    });

    it('transitions to LOAD_ERROR and throws on mount failure', async () => {
      const app = createMockApp();
      vi.mocked(app.mount).mockRejectedValue(new Error('mount failed'));
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await expect(runner.mount()).rejects.toThrow('mount failed');
      expect(runner.status).toBe('LOAD_ERROR');
    });
  });

  describe('unmount', () => {
    it('transitions from MOUNTED to NOT_MOUNTED', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();
      await runner.unmount();

      expect(app.unmount).toHaveBeenCalledWith(container);
      expect(runner.status).toBe('NOT_MOUNTED');
    });

    it('throws when called in a state other than MOUNTED', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await expect(runner.unmount()).rejects.toThrow('Cannot unmount in current state');
    });

    it('transitions to LOAD_ERROR and throws on unmount failure', async () => {
      const app = createMockApp();
      vi.mocked(app.unmount).mockRejectedValue(new Error('unmount failed'));
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();
      await expect(runner.unmount()).rejects.toThrow('unmount failed');
      expect(runner.status).toBe('LOAD_ERROR');
    });

    it('passes through the UNMOUNTING intermediate state', async () => {
      const app = createMockApp();
      const transitions: Array<[string, string]> = [];
      const runner = createLifecycleRunner({
        app,
        container,
        onStatusChange: (from, to) => transitions.push([from, to]),
      });

      await runner.bootstrap();
      await runner.mount();
      await runner.unmount();

      expect(transitions).toStrictEqual([
        ['NOT_LOADED', 'BOOTSTRAPPING'],
        ['BOOTSTRAPPING', 'NOT_MOUNTED'],
        ['NOT_MOUNTED', 'MOUNTED'],
        ['MOUNTED', 'UNMOUNTING'],
        ['UNMOUNTING', 'NOT_MOUNTED'],
      ]);
    });
  });

  describe('update', () => {
    it('passes props to the app', async () => {
      const app = createMockApp({ withUpdate: true });
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();

      const props = { theme: 'dark' };
      await runner.update(props);

      expect(app.update).toHaveBeenCalledWith(props);
    });

    it('throws when called in a state other than MOUNTED', async () => {
      const app = createMockApp({ withUpdate: true });
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await expect(runner.update({ foo: 'bar' })).rejects.toThrow('Cannot update in current state');
    });

    it('throws when the app does not implement update', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();

      await expect(runner.update({ foo: 'bar' })).rejects.toThrow(
        'App does not implement the update lifecycle',
      );
    });
  });

  describe('remount', () => {
    it('can mount again after unmount', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();
      await runner.unmount();
      await runner.mount();

      expect(app.mount).toHaveBeenCalledTimes(2);
      expect(runner.status).toBe('MOUNTED');
    });
  });
});
