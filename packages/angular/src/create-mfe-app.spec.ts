/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAngularMfeApp } from './create-mfe-app.js';
import { ESMAP_PROPS } from './props-token.js';

// Mock Angular modules since Angular requires full Zone.js + compiler in jsdom
vi.mock('@angular/core', () => ({
  InjectionToken: class InjectionToken {
    constructor(readonly description: string) {}
  },
  signal: vi.fn((initial: unknown) => {
    const state = { value: initial };
    const signalFn = () => state.value;
    signalFn.set = (v: unknown) => {
      state.value = v;
    };
    signalFn.asReadonly = () => signalFn;
    return signalFn;
  }),
}));

vi.mock('@angular/platform-browser', () => ({
  createApplication: vi.fn(),
}));

import { createApplication } from '@angular/platform-browser';

/** Creates a mock Angular ApplicationRef */
function createMockAppRef() {
  return {
    bootstrap: vi.fn(),
    destroy: vi.fn(),
  };
}

/** Mock Angular component class with selector metadata */
class TestComponent {}
Object.defineProperty(TestComponent, 'ɵcmp', {
  value: { selectors: [['app-test']] },
});

/** Mock Angular component without metadata (fallback selector) */
class DashboardComponent {}

describe('createAngularMfeApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.clearAllMocks();
  });

  it('MfeApp 라이프사이클 인터페이스를 반환한다', () => {
    const app = createAngularMfeApp({ rootComponent: TestComponent });

    expect(typeof app.bootstrap).toBe('function');
    expect(typeof app.mount).toBe('function');
    expect(typeof app.unmount).toBe('function');
    expect(typeof app.update).toBe('function');
  });

  it('bootstrap가 에러 없이 완료된다', async () => {
    const app = createAngularMfeApp({ rootComponent: TestComponent });
    await expect(app.bootstrap()).resolves.toStrictEqual(undefined);
  });

  it('mount 시 createApplication을 호출하고 컴포넌트를 부트스트랩한다', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(createApplication).toHaveBeenCalledWith({
      providers: [{ provide: ESMAP_PROPS, useValue: expect.any(Function) }],
    });
    expect(mockAppRef.bootstrap).toHaveBeenCalledWith(TestComponent, expect.any(HTMLElement));
  });

  it('mount 시 컴포넌트 셀렉터로 호스트 엘리먼트를 생성한다', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    const hostElement = container.querySelector('app-test');
    expect(hostElement).not.toBeNull();
  });

  it('unmount 시 앱을 destroy하고 DOM을 정리한다', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);

    expect(mockAppRef.destroy).toHaveBeenCalledOnce();
    expect(container.innerHTML).toBe('');
  });

  it('이미 마운트된 상태에서 재마운트 시 에러를 던진다', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    await expect(app.mount(container)).rejects.toThrow('already mounted');
  });

  it('unmount 후 다시 mount할 수 있다 (라우트 재진입)', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);
    await app.unmount(container);
    await app.mount(container);

    expect(createApplication).toHaveBeenCalledTimes(2);
    expect(mockAppRef.bootstrap).toHaveBeenCalledTimes(2);
  });

  it('마운트되지 않은 상태에서 unmount해도 에러를 던지지 않는다', async () => {
    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await expect(app.unmount(container)).resolves.toBeUndefined();
  });

  it('providers 옵션을 createApplication에 전달한다', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const mockProvider = { provide: 'TOKEN', useValue: 'test' };
    const app = createAngularMfeApp({
      rootComponent: TestComponent,
      providers: [mockProvider],
    });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    expect(createApplication).toHaveBeenCalledWith({
      providers: [
        { provide: ESMAP_PROPS, useValue: expect.any(Function) },
        mockProvider,
      ],
    });
  });

  it('ɵcmp 메타데이터가 없으면 클래스명에서 셀렉터를 유추한다', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: DashboardComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    const hostElement = container.querySelector('dashboard');
    expect(hostElement).not.toBeNull();
  });

  it('update 호출 시 ESMAP_PROPS 시그널에 props를 전달한다', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    // Extract the signal passed to createApplication
    const callArgs = vi.mocked(createApplication).mock.calls[0]!;
    const providers = callArgs[0]!.providers as Array<{
      provide: unknown;
      useValue: (() => unknown) & { set: (v: unknown) => void };
    }>;
    const propsProvider = providers.find((p) => p.provide === ESMAP_PROPS)!;
    const propsSignal = propsProvider.useValue;

    expect(propsSignal()).toStrictEqual({});

    await app.update!({ name: 'World' });

    expect(propsSignal()).toStrictEqual({ name: 'World' });
  });
});
