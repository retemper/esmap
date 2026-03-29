import { describe, it, expect } from 'vitest';
import { createMockApp, createFailingApp } from './mock-app.js';

describe('createMockApp', () => {
  it('기본 라이프사이클 메서드를 가진 mock 앱을 생성한다', async () => {
    const app = createMockApp();

    await app.bootstrap();
    await app.mount(document.createElement('div'));
    await app.unmount(document.createElement('div'));

    expect(app.bootstrapSpy.callCount).toBe(1);
    expect(app.mountSpy.callCount).toBe(1);
    expect(app.unmountSpy.callCount).toBe(1);
  });

  it('update 메서드가 호출을 추적한다', async () => {
    const app = createMockApp();
    const props = { count: 1 };

    await app.update!(props);

    expect(app.updateSpy.callCount).toBe(1);
    expect(app.updateSpy.calls[0].args[0]).toStrictEqual(props);
  });

  it('스파이 호출 기록에 타임스탬프가 포함된다', async () => {
    const app = createMockApp();
    const before = Date.now();

    await app.bootstrap();

    const after = Date.now();
    const { timestamp } = app.bootstrapSpy.calls[0];

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('reset()으로 호출 기록을 초기화한다', async () => {
    const app = createMockApp();

    await app.bootstrap();
    expect(app.bootstrapSpy.callCount).toBe(1);

    app.bootstrapSpy.reset();
    expect(app.bootstrapSpy.callCount).toBe(0);
    expect(app.bootstrapSpy.calls).toStrictEqual([]);
  });

  it('mount 호출 시 container 인자를 기록한다', async () => {
    const app = createMockApp();
    const container = document.createElement('div');

    await app.mount(container);

    expect(app.mountSpy.calls[0].args[0]).toBe(container);
  });

  it('커스텀 오버라이드 함수가 실행된다', async () => {
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

  it('여러 번 호출 시 호출 횟수가 누적된다', async () => {
    const app = createMockApp();
    const container = document.createElement('div');

    await app.mount(container);
    await app.mount(container);
    await app.mount(container);

    expect(app.mountSpy.callCount).toBe(3);
  });
});

describe('createFailingApp', () => {
  it('지정한 단계에서 에러를 던진다', async () => {
    const app = createFailingApp('bootstrap');

    await expect(app.bootstrap()).rejects.toThrow('bootstrap failed');
  });

  it('커스텀 에러 메시지를 사용한다', async () => {
    const customError = new Error('custom mount error');
    const app = createFailingApp('mount', customError);
    const container = document.createElement('div');

    await expect(app.mount(container)).rejects.toThrow('custom mount error');
  });

  it('실패하지 않는 단계는 정상 동작한다', async () => {
    const app = createFailingApp('unmount');

    await expect(app.bootstrap()).resolves.toBeUndefined();
    await expect(app.mount(document.createElement('div'))).resolves.toBeUndefined();
  });

  it('update 단계 실패를 지원한다', async () => {
    const app = createFailingApp('update');
    const props = { key: 'value' };

    await expect(app.update!(props)).rejects.toThrow('update failed');
  });

  it('실패 앱도 스파이 호출을 추적한다', async () => {
    const app = createFailingApp('bootstrap');

    await app.bootstrap().catch(() => {});

    expect(app.bootstrapSpy.callCount).toBe(1);
  });
});
