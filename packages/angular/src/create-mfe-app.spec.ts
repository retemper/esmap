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

  it('returns the MfeApp lifecycle interface', () => {
    const app = createAngularMfeApp({ rootComponent: TestComponent });

    expect(typeof app.bootstrap).toBe('function');
    expect(typeof app.mount).toBe('function');
    expect(typeof app.unmount).toBe('function');
    expect(typeof app.update).toBe('function');
  });

  it('completes bootstrap without errors', async () => {
    const app = createAngularMfeApp({ rootComponent: TestComponent });
    await expect(app.bootstrap()).resolves.toStrictEqual(undefined);
  });

  it('calls createApplication and bootstraps the component on mount', async () => {
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

  it('creates a host element with the component selector on mount', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    const hostElement = container.querySelector('app-test');
    expect(hostElement).not.toBeNull();
  });

  it('destroys the app and cleans up the DOM on unmount', async () => {
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

  it('throws an error when remounting while already mounted', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    await expect(app.mount(container)).rejects.toThrow('already mounted');
  });

  it('can remount after unmount (route re-entry)', async () => {
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

  it('does not throw when unmounting while not mounted', async () => {
    const app = createAngularMfeApp({ rootComponent: TestComponent });
    const container = document.getElementById('app')!;

    await expect(app.unmount(container)).resolves.toBeUndefined();
  });

  it('passes providers option to createApplication', async () => {
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
      providers: [{ provide: ESMAP_PROPS, useValue: expect.any(Function) }, mockProvider],
    });
  });

  it('infers selector from class name when ɵcmp metadata is missing', async () => {
    const mockAppRef = createMockAppRef();
    vi.mocked(createApplication).mockResolvedValue(mockAppRef as never);

    const app = createAngularMfeApp({ rootComponent: DashboardComponent });
    const container = document.getElementById('app')!;

    await app.bootstrap();
    await app.mount(container);

    const hostElement = container.querySelector('dashboard');
    expect(hostElement).not.toBeNull();
  });

  it('passes props to the ESMAP_PROPS signal on update', async () => {
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
