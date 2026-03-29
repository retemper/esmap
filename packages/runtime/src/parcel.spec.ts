import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountParcel } from './parcel.js';
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

describe('mountParcel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('앱을 직접 전달하면 bootstrap과 mount를 호출한다', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    expect(app.bootstrap).toHaveBeenCalledOnce();
    expect(app.mount).toHaveBeenCalledWith(container);
    expect(parcel.status).toBe('MOUNTED');
  });

  it('비동기 로더 함수를 전달하면 앱을 로드하고 마운트한다', async () => {
    const app = createMockApp();
    const loader = vi.fn().mockResolvedValue(app);
    const parcel = await mountParcel({ app: loader, domElement: container });

    expect(loader).toHaveBeenCalledOnce();
    expect(app.bootstrap).toHaveBeenCalledOnce();
    expect(parcel.status).toBe('MOUNTED');
  });

  it('초기 props가 있고 앱이 update를 구현하면 mount 후 update를 호출한다', async () => {
    const app = createMockApp({ withUpdate: true });
    const props = { theme: 'dark' };
    await mountParcel({ app, domElement: container, props });

    expect(app.update).toHaveBeenCalledWith(props);
  });

  it('초기 props가 있지만 앱이 update를 구현하지 않으면 update를 호출하지 않는다', async () => {
    const app = createMockApp();
    const props = { theme: 'dark' };
    const parcel = await mountParcel({ app, domElement: container, props });

    expect(parcel.status).toBe('MOUNTED');
  });

  it('unmount를 호출하면 NOT_MOUNTED 상태가 된다', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    await parcel.unmount();

    expect(app.unmount).toHaveBeenCalledWith(container);
    expect(parcel.status).toBe('NOT_MOUNTED');
  });

  it('이미 언마운트된 parcel을 다시 언마운트하면 에러를 던진다', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    await parcel.unmount();

    await expect(parcel.unmount()).rejects.toThrow('unmount할 수 없는 상태');
  });

  it('update를 호출하면 앱의 update를 실행한다', async () => {
    const app = createMockApp({ withUpdate: true });
    const parcel = await mountParcel({ app, domElement: container });

    const newProps = { count: 42 };
    await parcel.update(newProps);

    expect(app.update).toHaveBeenCalledWith(newProps);
  });

  it('앱이 update를 구현하지 않으면 update 호출 시 에러를 던진다', async () => {
    const app = createMockApp();
    const parcel = await mountParcel({ app, domElement: container });

    await expect(parcel.update({ foo: 'bar' })).rejects.toThrow(
      'update 라이프사이클을 구현하지 않았습니다',
    );
  });

  it('언마운트 상태에서 update를 호출하면 에러를 던진다', async () => {
    const app = createMockApp({ withUpdate: true });
    const parcel = await mountParcel({ app, domElement: container });

    await parcel.unmount();

    await expect(parcel.update({ foo: 'bar' })).rejects.toThrow('update할 수 없는 상태');
  });

  it('bootstrap이 실패하면 LOAD_ERROR 상태가 된다', async () => {
    const app = createMockApp();
    vi.mocked(app.bootstrap).mockRejectedValue(new Error('bootstrap 실패'));

    await expect(mountParcel({ app, domElement: container })).rejects.toThrow('bootstrap 실패');
  });

  it('mount가 실패하면 LOAD_ERROR 상태가 된다', async () => {
    const app = createMockApp();
    vi.mocked(app.mount).mockRejectedValue(new Error('mount 실패'));

    await expect(mountParcel({ app, domElement: container })).rejects.toThrow('mount 실패');
  });

  it('unmount가 실패하면 LOAD_ERROR 상태가 되고 에러를 다시 던진다', async () => {
    const app = createMockApp();
    vi.mocked(app.unmount).mockRejectedValue(new Error('unmount 실패'));

    const parcel = await mountParcel({ app, domElement: container });

    await expect(parcel.unmount()).rejects.toThrow('unmount 실패');
    expect(parcel.status).toBe('LOAD_ERROR');
  });

  it('비동기 로더가 실패하면 에러를 전파한다', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('로드 실패'));

    await expect(mountParcel({ app: loader, domElement: container })).rejects.toThrow('로드 실패');
  });
});
