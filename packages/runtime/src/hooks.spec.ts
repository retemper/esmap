import { describe, it, expect, vi } from 'vitest';
import { createLifecycleHooks } from './hooks.js';
import type { HookContext, HookError } from './hooks.js';

describe('createLifecycleHooks', () => {
  describe('beforeEach', () => {
    it('글로벌 before 훅이 모든 앱에 대해 실행된다', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.beforeEach('mount', () => {
        calls.push('global-before-mount');
      });

      await hooks.runHooks('app-a', 'mount', 'before');
      await hooks.runHooks('app-b', 'mount', 'before');

      expect(calls).toStrictEqual(['global-before-mount', 'global-before-mount']);
    });

    it('다른 phase의 훅은 실행되지 않는다', async () => {
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
    it('글로벌 after 훅이 모든 앱에 대해 실행된다', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.afterEach('bootstrap', () => {
        calls.push('global-after-bootstrap');
      });

      await hooks.runHooks('app-a', 'bootstrap', 'after');

      expect(calls).toStrictEqual(['global-after-bootstrap']);
    });
  });

  describe('before (앱별)', () => {
    it('지정된 앱에만 before 훅이 실행된다', async () => {
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

  describe('after (앱별)', () => {
    it('지정된 앱에만 after 훅이 실행된다', async () => {
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

  describe('실행 순서', () => {
    it('글로벌 훅과 앱별 훅이 등록 순서대로 실행된다', async () => {
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

    it('before와 after는 별도 timing으로 독립 실행된다', async () => {
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
    it('훅에 올바른 컨텍스트가 전달된다', async () => {
      const hooks = createLifecycleHooks();
      const contexts: HookContext[] = [];

      hooks.beforeEach('update', (ctx) => {
        contexts.push(ctx);
      });

      await hooks.runHooks('my-app', 'update', 'before');

      expect(contexts).toStrictEqual([{ appName: 'my-app', phase: 'update' }]);
    });
  });

  describe('비동기 훅', () => {
    it('비동기 훅이 순차적으로 실행된다', async () => {
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

  describe('에러 처리', () => {
    it('onError 미설정 시 훅 에러가 전파된다', async () => {
      const hooks = createLifecycleHooks();

      hooks.beforeEach('mount', () => {
        throw new Error('훅 에러');
      });

      await expect(hooks.runHooks('app-a', 'mount', 'before')).rejects.toThrow('훅 에러');
    });

    it('onError 설정 시 에러를 잡고 나머지 훅을 계속 실행한다', async () => {
      const errors: HookError[] = [];
      const hooks = createLifecycleHooks({
        onError: (hookError) => errors.push(hookError),
      });
      const calls: string[] = [];

      hooks.beforeEach('mount', () => {
        throw new Error('첫 번째 훅 에러');
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

    it('onError 설정 시 여러 훅의 에러를 모두 수집한다', async () => {
      const errors: HookError[] = [];
      const hooks = createLifecycleHooks({
        onError: (hookError) => errors.push(hookError),
      });

      hooks.beforeEach('mount', () => {
        throw new Error('에러 1');
      });
      hooks.beforeEach('mount', () => {
        throw new Error('에러 2');
      });

      await hooks.runHooks('app-a', 'mount', 'before');

      expect(errors).toHaveLength(2);
    });

    it('onError 미설정 시 첫 에러에서 중단하고 나머지 훅은 실행하지 않는다', async () => {
      const hooks = createLifecycleHooks();
      const calls: string[] = [];

      hooks.beforeEach('mount', () => {
        throw new Error('중단');
      });
      hooks.beforeEach('mount', () => {
        calls.push('도달 불가');
      });

      await expect(hooks.runHooks('app-a', 'mount', 'before')).rejects.toThrow('중단');
      expect(calls).toStrictEqual([]);
    });
  });

  describe('매칭되는 훅이 없는 경우', () => {
    it('등록된 훅이 없으면 아무 일도 일어나지 않는다', async () => {
      const hooks = createLifecycleHooks();

      await hooks.runHooks('app-a', 'mount', 'before');
    });
  });
});
