/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { defineAdapter } from './adapter.js';
import type { AdapterProtocol } from './types/adapter.js';

/** Creates a mock protocol for testing */
function createMockProtocol(): AdapterProtocol<{ id: string }> {
  return {
    mount: vi.fn(() => ({ id: 'test-context' })),
    update: vi.fn(),
    unmount: vi.fn(),
  };
}

/** Creates a DOM container for testing */
function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('defineAdapter', () => {
  it('returns an MfeApp lifecycle object', () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });

    expect(app.bootstrap).toBeTypeOf('function');
    expect(app.mount).toBeTypeOf('function');
    expect(app.unmount).toBeTypeOf('function');
    expect(app.update).toBeTypeOf('function');
  });

  it('bootstrap does nothing', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });

    await expect(app.bootstrap()).resolves.toBeUndefined();
    expect(protocol.mount).not.toHaveBeenCalled();
  });

  it('calls protocol.mount on mount', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);

    expect(protocol.mount).toHaveBeenCalledWith(container);
    expect(protocol.mount).toHaveBeenCalledOnce();
  });

  it('calls protocol.unmount on unmount', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);

    expect(protocol.unmount).toHaveBeenCalledWith({ id: 'test-context' }, container);
    expect(protocol.unmount).toHaveBeenCalledOnce();
  });

  it('calls protocol.update on update', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);

    const props = { theme: 'dark', count: 42 };
    await app.update!(props);

    expect(protocol.update).toHaveBeenCalledWith({ id: 'test-context' }, props);
  });

  it('throws an error when mounting an already mounted adapter', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'my-adapter', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);

    await expect(app.mount(container)).rejects.toThrow('already mounted');
    expect(protocol.mount).toHaveBeenCalledOnce();
  });

  it('does not throw when unmounting a non-mounted adapter', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await expect(app.unmount(container)).resolves.toBeUndefined();
    expect(protocol.unmount).not.toHaveBeenCalled();
  });

  it('does not throw when updating a non-mounted adapter', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });

    await expect(app.update!({ foo: 'bar' })).resolves.toBeUndefined();
    expect(protocol.update).not.toHaveBeenCalled();
  });

  it('does not call protocol.update after unmount', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.update!({ foo: 'bar' });

    expect(protocol.update).not.toHaveBeenCalled();
  });

  it('can mount again after unmount', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.mount(container);

    expect(protocol.mount).toHaveBeenCalledTimes(2);
  });

  it('propagates errors from protocol.mount', async () => {
    const protocol = createMockProtocol();
    vi.mocked(protocol.mount).mockImplementation(() => {
      throw new Error('setup failed');
    });
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await expect(app.mount(container)).rejects.toThrow('setup failed');
  });

  it('propagates errors from protocol.unmount', async () => {
    const protocol = createMockProtocol();
    vi.mocked(protocol.unmount).mockImplementation(() => {
      throw new Error('cleanup failed');
    });
    const app = defineAdapter({ name: 'test', protocol });
    const container = createContainer();

    await app.bootstrap();
    await app.mount(container);
    await expect(app.unmount(container)).rejects.toThrow('cleanup failed');
  });

  it('includes the adapter name in error messages', async () => {
    const protocol = createMockProtocol();
    const app = defineAdapter({ name: 'vue', protocol });
    const container = createContainer();

    await app.mount(container);
    await expect(app.mount(container)).rejects.toThrow('[vue]');
  });
});
