import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLifecycleRunner } from './lifecycle-runner.js';
import type { MfeApp } from '@esmap/shared';

/** 테스트용 MfeApp 목을 생성한다 */
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

  describe('초기 상태', () => {
    it('NOT_LOADED 상태로 시작한다', () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      expect(runner.status).toBe('NOT_LOADED');
    });
  });

  describe('bootstrap', () => {
    it('NOT_LOADED에서 NOT_MOUNTED로 전이한다', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();

      expect(app.bootstrap).toHaveBeenCalledOnce();
      expect(runner.status).toBe('NOT_MOUNTED');
    });

    it('이미 bootstrap된 상태에서는 무시한다', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.bootstrap();

      expect(app.bootstrap).toHaveBeenCalledOnce();
    });

    it('실패 시 LOAD_ERROR로 전이하고 에러를 던진다', async () => {
      const app = createMockApp();
      vi.mocked(app.bootstrap).mockRejectedValue(new Error('bootstrap 실패'));
      const runner = createLifecycleRunner({ app, container });

      await expect(runner.bootstrap()).rejects.toThrow('bootstrap 실패');
      expect(runner.status).toBe('LOAD_ERROR');
    });

    it('상태 변경 콜백을 호출한다', async () => {
      const app = createMockApp();
      const onStatusChange = vi.fn();
      const runner = createLifecycleRunner({ app, container, onStatusChange });

      await runner.bootstrap();

      expect(onStatusChange).toHaveBeenCalledWith('NOT_LOADED', 'BOOTSTRAPPING');
      expect(onStatusChange).toHaveBeenCalledWith('BOOTSTRAPPING', 'NOT_MOUNTED');
    });
  });

  describe('mount', () => {
    it('NOT_MOUNTED에서 MOUNTED로 전이한다', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();

      expect(app.mount).toHaveBeenCalledWith(container);
      expect(runner.status).toBe('MOUNTED');
    });

    it('NOT_MOUNTED가 아닌 상태에서 호출하면 에러를 던진다', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await expect(runner.mount()).rejects.toThrow('mount할 수 없는 상태');
    });

    it('실패 시 LOAD_ERROR로 전이하고 에러를 던진다', async () => {
      const app = createMockApp();
      vi.mocked(app.mount).mockRejectedValue(new Error('mount 실패'));
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await expect(runner.mount()).rejects.toThrow('mount 실패');
      expect(runner.status).toBe('LOAD_ERROR');
    });
  });

  describe('unmount', () => {
    it('MOUNTED에서 NOT_MOUNTED로 전이한다', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();
      await runner.unmount();

      expect(app.unmount).toHaveBeenCalledWith(container);
      expect(runner.status).toBe('NOT_MOUNTED');
    });

    it('MOUNTED가 아닌 상태에서 호출하면 에러를 던진다', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await expect(runner.unmount()).rejects.toThrow('unmount할 수 없는 상태');
    });

    it('실패 시 LOAD_ERROR로 전이하고 에러를 던진다', async () => {
      const app = createMockApp();
      vi.mocked(app.unmount).mockRejectedValue(new Error('unmount 실패'));
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();
      await expect(runner.unmount()).rejects.toThrow('unmount 실패');
      expect(runner.status).toBe('LOAD_ERROR');
    });

    it('UNMOUNTING 중간 상태를 거친다', async () => {
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
    it('props를 앱에 전달한다', async () => {
      const app = createMockApp({ withUpdate: true });
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();

      const props = { theme: 'dark' };
      await runner.update(props);

      expect(app.update).toHaveBeenCalledWith(props);
    });

    it('MOUNTED가 아닌 상태에서 호출하면 에러를 던진다', async () => {
      const app = createMockApp({ withUpdate: true });
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await expect(runner.update({ foo: 'bar' })).rejects.toThrow('update할 수 없는 상태');
    });

    it('앱이 update를 구현하지 않으면 에러를 던진다', async () => {
      const app = createMockApp();
      const runner = createLifecycleRunner({ app, container });

      await runner.bootstrap();
      await runner.mount();

      await expect(runner.update({ foo: 'bar' })).rejects.toThrow(
        'update 라이프사이클을 구현하지 않았습니다',
      );
    });
  });

  describe('remount', () => {
    it('unmount 후 다시 mount할 수 있다', async () => {
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
