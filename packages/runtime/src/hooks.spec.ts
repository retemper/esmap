import { describe, it, expect, vi } from 'vitest';
import { createLifecycleHooks } from './hooks.js';
import type { HookContext, HookError } from './hooks.js';

describe('createLifecycleHooks', () => {
  describe('beforeEach', () => {
    it('executes global before hooks for all apps', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.beforeEach('mount', () => {
        calls.push('global-before-mount');
      });

      await hooks.runHooks('app-a', 'mount', 'before');
      await hooks.runHooks('app-b', 'mount', 'before');

      expect(calls).toStrictEqual(['global-before-mount', 'global-before-mount']);
    });

    it('does not execute hooks for other phases', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.beforeEach('mount', () => {
        calls.push('mount');
      });
      hooks.beforeEach('unmount', () => {
        calls.push('unmount');
      });

      await hooks.runHooks('app-a', 'mount', 'before');

      expect(calls).toStrictEqual(['mount']);
    });
  });

  describe('afterEach', () => {
    it('executes global after hooks for all apps', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.afterEach('bootstrap', () => {
        calls.push('global-after-bootstrap');
      });

      await hooks.runHooks('app-a', 'bootstrap', 'after');

      expect(calls).toStrictEqual(['global-after-bootstrap']);
    });
  });

  describe('before (per-app)', () => {
    it('executes before hooks only for the specified app', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.before('app-a', 'mount', () => {
        calls.push('app-a-before-mount');
      });

      await hooks.runHooks('app-a', 'mount', 'before');
      await hooks.runHooks('app-b', 'mount', 'before');

      expect(calls).toStrictEqual(['app-a-before-mount']);
    });
  });

  describe('after (per-app)', () => {
    it('executes after hooks only for the specified app', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.after('app-x', 'unmount', () => {
        calls.push('app-x-after-unmount');
      });

      await hooks.runHooks('app-x', 'unmount', 'after');
      await hooks.runHooks('app-y', 'unmount', 'after');

      expect(calls).toStrictEqual(['app-x-after-unmount']);
    });
  });

  describe('execution order', () => {
    it('executes global and per-app hooks in registration order', async () => {
      const hooks = createLifecycleHooks();
      const order: number[] = [];

      hooks.beforeEach('mount', () => {
        order.push(1);
      });
      hooks.before('app-a', 'mount', () => {
        order.push(2);
      });
      hooks.beforeEach('mount', () => {
        order.push(3);
      });

      await hooks.runHooks('app-a', 'mount', 'before');

      expect(order).toStrictEqual([1, 2, 3]);
    });

    it('before and after run independently as separate timings', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.beforeEach('load', () => {
        calls.push('before');
      });
      hooks.afterEach('load', () => {
        calls.push('after');
      });

      await hooks.runHooks('app-a', 'load', 'before');
      await hooks.runHooks('app-a', 'load', 'after');

      expect(calls).toStrictEqual(['before', 'after']);
    });
  });

  describe('HookContext', () => {
    it('passes the correct context to hooks', async () => {
      const hooks = createLifecycleHooks();
      const contexts: HookContext[] = [];

      hooks.beforeEach('update', (ctx) => {
        contexts.push(ctx);
      });

      await hooks.runHooks('my-app', 'update', 'before');

      expect(contexts).toStrictEqual([{ appName: 'my-app', phase: 'update' }]);
    });
  });

  describe('async hooks', () => {
    it('executes async hooks sequentially', async () => {
      const hooks = createLifecycleHooks();
      const order: number[] = [];

      hooks.beforeEach('mount', async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        order.push(1);
      });
      hooks.beforeEach('mount', () => {
        order.push(2);
      });

      await hooks.runHooks('app-a', 'mount', 'before');

      expect(order).toStrictEqual([1, 2]);
    });
  });

  describe('error handling', () => {
    it('propagates hook errors when onError is not set', async () => {
      const hooks = createLifecycleHooks();

      hooks.beforeEach('mount', () => {
        throw new Error('hook error');
      });

      await expect(hooks.runHooks('app-a', 'mount', 'before')).rejects.toThrow('hook error');
    });

    it('catches errors and continues executing remaining hooks when onError is set', async () => {
      const errors: HookError[] = [];
      const hooks = createLifecycleHooks({
        onError: (hookError) => errors.push(hookError),
      });
      const calls: string[] = [];

      hooks.beforeEach('mount', () => {
        throw new Error('first hook error');
      });
      hooks.beforeEach('mount', () => {
        calls.push('second-hook-executed');
      });

      await hooks.runHooks('app-a', 'mount', 'before');

      expect(errors).toHaveLength(1);
      expect(errors[0].context).toStrictEqual({ appName: 'app-a', phase: 'mount' });
      expect(errors[0].error).toBeInstanceOf(Error);
      expect(calls).toStrictEqual(['second-hook-executed']);
    });

    it('collects errors from multiple hooks when onError is set', async () => {
      const errors: HookError[] = [];
      const hooks = createLifecycleHooks({
        onError: (hookError) => errors.push(hookError),
      });

      hooks.beforeEach('mount', () => {
        throw new Error('error 1');
      });
      hooks.beforeEach('mount', () => {
        throw new Error('error 2');
      });

      await hooks.runHooks('app-a', 'mount', 'before');

      expect(errors).toHaveLength(2);
    });

    it('stops at the first error and does not execute remaining hooks when onError is not set', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.beforeEach('mount', () => {
        throw new Error('abort');
      });
      hooks.beforeEach('mount', () => {
        calls.push('unreachable');
      });

      await expect(hooks.runHooks('app-a', 'mount', 'before')).rejects.toThrow('abort');
      expect(calls).toStrictEqual([]);
    });
  });

  describe('no matching hooks', () => {
    it('does nothing when no hooks are registered', async () => {
      const hooks = createLifecycleHooks();

      await hooks.runHooks('app-a', 'mount', 'before');
    });
  });
});
