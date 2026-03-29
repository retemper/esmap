/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { defineAdapter } from './adapter.js';
import type { AdapterProtocol } from './types/adapter.js';

/** 테스트용 mock 프로토콜을 생성한다 */
function createMockProtocol(): AdapterProtocol<{ id: string }> {
  return {
    mount: vi.fn(() => ({ id: 'test-context' })),
    update: vi.fn(),
    unmount: vi.fn(),
  };
}

/** 테스트용 DOM 컨테이너를 생성한다 */
function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('defineAdapter', () => {
  it('MfeApp 라이프사이클 객체를 반환한다', () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });

    expect(app.bootstrap).toBeTypeOf('function');
    expect(app.mount).toBeTypeOf('function');
    expect(app.unmount).toBeTypeOf('function');
    expect(app.update).toBeTypeOf('function');
  });

  it('bootstrap은 아무 동작도 하지 않는다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });

    await expect(app.bootstrap()).resolves.toBeUndefined();
    expect(protocol.mount).not.toHaveBeenCalled();
  });

  it('mount 시 protocol.mount를 호출한다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);

    expect(protocol.mount).toHaveBeenCalledWith(container);
    expect(protocol.mount).toHaveBeenCalledOnce();
  });

  it('unmount 시 protocol.unmount를 호출한다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);

    expect(protocol.unmount).toHaveBeenCalledWith({ id: 'test-context' }, container);
    expect(protocol.unmount).toHaveBeenCalledOnce();
  });

  it('update 시 protocol.update를 호출한다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);

    const props = { theme: 'dark', count: 42 };
    await app.update!(props);

    expect(protocol.update).toHaveBeenCalledWith({ id: 'test-context' }, props);
  });

  it('이미 마운트된 상태에서 다시 mount하면 에러를 던진다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'my-adapter', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);

    await expect(app.mount(container)).rejects.toThrow('이미 마운트된 어댑터');
    expect(protocol.mount).toHaveBeenCalledOnce();
  });

  it('마운트되지 않은 상태에서 unmount해도 에러를 던지지 않는다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await expect(app.unmount(container)).resolves.toBeUndefined();
    expect(protocol.unmount).not.toHaveBeenCalled();
  });

  it('마운트되지 않은 상태에서 update해도 에러를 던지지 않는다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });

    await expect(app.update!({ foo: 'bar' })).resolves.toBeUndefined();
    expect(protocol.update).not.toHaveBeenCalled();
  });

  it('unmount 후 update를 호출하면 protocol.update를 호출하지 않는다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.update!({ foo: 'bar' });

    expect(protocol.update).not.toHaveBeenCalled();
  });

  it('unmount 후 다시 mount할 수 있다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.mount(container);

    expect(protocol.mount).toHaveBeenCalledTimes(2);
  });

  it('protocol.mount에서 에러가 발생하면 전파한다', async () => {
    const protocol = createMockProtocol();
    vi.mocked(protocol.mount).mockImplementation(() => {
      throw new Error('setup 실패');
    });
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await expect(app.mount(container)).rejects.toThrow('setup 실패');
  });

  it('protocol.unmount에서 에러가 발생하면 전파한다', async () => {
    const protocol = createMockProtocol();
    vi.mocked(protocol.unmount).mockImplementation(() => {
      throw new Error('cleanup 실패');
    });
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await expect(app.unmount(container)).rejects.toThrow('cleanup 실패');
  });

  it('에러 메시지에 어댑터 이름이 포함된다', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'vue', protocol });
    const container = createContainer();

    await app.mount(container);
    await expect(app.mount(container)).rejects.toThrow('[vue]');
  });
});
