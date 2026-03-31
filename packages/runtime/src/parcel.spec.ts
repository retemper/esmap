import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountParcel } from './parcel.js';
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

describe('mountParcel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('calls bootstrap and mount when an app is passed directly', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    expect(app.bootstrap).toHaveBeenCalledOnce();
    expect(app.mount).toHaveBeenCalledWith(container);
    expect(parcel.status).toBe('MOUNTED');
  });

  it('loads and mounts the app when an async loader function is passed', async () => {
    const app = createMockApp();
    const loader = vi.fn().mockResolvedValue(app);
    const parcel = await mountParcel({ app: loader, domElement: container });

    expect(loader).toHaveBeenCalledOnce();
    expect(app.bootstrap).toHaveBeenCalledOnce();
    expect(parcel.status).toBe('MOUNTED');
  });

  it('calls update after mount when initial props are provided and app implements update', async () => {
    const app = createMockApp({ withUpdate: true });
    const props = { theme: 'dark' };
    await mountParcel({ app, domElement: container, props });

    expect(app.update).toHaveBeenCalledWith(props);
  });

  it('does not call update when initial props are provided but app does not implement update', async () => {
    const app = createMockApp();
    const props = { theme: 'dark' };
    const parcel = await mountParcel({ app, domElement: container, props });

    expect(parcel.status).toBe('MOUNTED');
  });

  it('transitions to NOT_MOUNTED when unmount is called', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    await parcel.unmount();

    expect(app.unmount).toHaveBeenCalledWith(container);
    expect(parcel.status).toBe('NOT_MOUNTED');
  });

  it('throws an error when unmounting an already unmounted parcel', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    await parcel.unmount();

    await expect(parcel.unmount()).rejects.toThrow('Cannot unmount in current state');
  });

  it('invokes the app update when update is called', async () => {
    const app = createMockApp({ withUpdate: true });
    const parcel = await mountParcel({ app, domElement: container });

    const newProps = { count: 42 };
    await parcel.update(newProps);

    expect(app.update).toHaveBeenCalledWith(newProps);
  });

  it('throws an error when update is called but app does not implement update', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    await expect(parcel.update({ foo: 'bar' })).rejects.toThrow(
      'App does not implement the update lifecycle',
    );
  });

  it('throws an error when update is called in unmounted state', async () => {
    const app = createMockApp({ withUpdate: true });
    const parcel = await mountParcel({ app, domElement: container });

    await parcel.unmount();

    await expect(parcel.update({ foo: 'bar' })).rejects.toThrow('Cannot update in current state');
  });

  it('transitions to LOAD_ERROR when bootstrap fails', async () => {
    const app = createMockApp();
    vi.mocked(app.bootstrap).mockRejectedValue(new Error('bootstrap failed'));

    await expect(mountParcel({ app, domElement: container })).rejects.toThrow('bootstrap failed');
  });

  it('transitions to LOAD_ERROR when mount fails', async () => {
    const app = createMockApp();
    vi.mocked(app.mount).mockRejectedValue(new Error('mount failed'));

    await expect(mountParcel({ app, domElement: container })).rejects.toThrow('mount failed');
  });

  it('transitions to LOAD_ERROR and re-throws when unmount fails', async () => {
    const app = createMockApp();
    vi.mocked(app.unmount).mockRejectedValue(new Error('unmount failed'));

    const parcel = await mountParcel({ app, domElement: container });

    await expect(parcel.unmount()).rejects.toThrow('unmount failed');
    expect(parcel.status).toBe('LOAD_ERROR');
  });

  it('propagates the error when the async loader fails', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('load failed'));

    await expect(mountParcel({ app: loader, domElement: container })).rejects.toThrow(
      'load failed',
    );
  });
});
