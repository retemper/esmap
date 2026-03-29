import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalState, useAppStatus } from './hooks.js';
import { createGlobalState } from '@esmap/communication';
import type { MfeAppStatus } from '@esmap/shared';

describe('useGlobalState', () => {
  it('현재 글로벌 상태를 반환한다', () => {
    const store = createGlobalState({ count: 0, name: 'test' });

    const { result } = renderHook(() => useGlobalState(store));

    expect(result.current).toStrictEqual({ count: 0, name: 'test' });
  });

  it('상태 변경 시 리렌더링된다', () => {
    const store = createGlobalState({ count: 0 });

    const { result } = renderHook(() => useGlobalState(store));

    act(() => {
      store.setState({ count: 42 });
    });

    expect(result.current).toStrictEqual({ count: 42 });
  });

  it('selector로 특정 값만 추출한다', () => {
    const store = createGlobalState({ count: 0, name: 'test' });

    const { result } = renderHook(() => useGlobalState(store, (s) => s.count));

    expect(result.current).toStrictEqual(0);
  });

  it('selector 사용 시 관련 없는 키 변경으로 리렌더링되지 않는다', () => {
    const store = createGlobalState({ count: 0, name: 'test' });
    const renderCount = { value: 0 };

    renderHook(() => {
      renderCount.value++;
      return useGlobalState(store, (s) => s.count);
    });

    const initialRenders = renderCount.value;

    act(() => {
      store.setState({ name: 'changed' });
    });

    // count가 변하지 않았으므로 리렌더링 없음 (useSyncExternalStore는 snapshot 비교)
    // 단, 상태 객체 자체는 새로 만들어지므로 selector 없이는 항상 리렌더링
    // selector가 원시값을 반환하면 === 비교로 리렌더링을 건너뜀
    expect(renderCount.value).toStrictEqual(initialRenders);
  });
});

describe('useAppStatus', () => {
  /** 테스트용 mock registry 생성 */
  function createMockRegistry(initialStatus: MfeAppStatus = 'NOT_LOADED') {
    const listeners: Array<(event: { appName: string; to: MfeAppStatus }) => void> = [];
    const apps = new Map<string, { status: MfeAppStatus }>();
    apps.set('test-app', { status: initialStatus });

    return {
      onStatusChange: vi.fn((listener: (event: { appName: string; to: MfeAppStatus }) => void) => {
        listeners.push(listener);
        return () => {
          const idx = listeners.indexOf(listener);
          if (idx !== -1) listeners.splice(idx, 1);
        };
      }),
      getApp: vi.fn((name: string) => apps.get(name)),
      /** 상태 변경을 시뮬레이션한다 */
      simulateChange(appName: string, to: MfeAppStatus) {
        const app = apps.get(appName);
        if (app) app.status = to;
        for (const listener of listeners) {
          listener({ appName, to });
        }
      },
    };
  }

  it('앱의 현재 상태를 반환한다', () => {
    const registry = createMockRegistry('MOUNTED');

    const { result } = renderHook(() => useAppStatus(registry, 'test-app'));

    expect(result.current).toStrictEqual('MOUNTED');
  });

  it('상태 변경 시 리렌더링된다', () => {
    const registry = createMockRegistry('NOT_LOADED');

    const { result } = renderHook(() => useAppStatus(registry, 'test-app'));

    expect(result.current).toStrictEqual('NOT_LOADED');

    act(() => {
      registry.simulateChange('test-app', 'MOUNTED');
    });

    expect(result.current).toStrictEqual('MOUNTED');
  });

  it('다른 앱의 상태 변경은 무시한다', () => {
    const registry = createMockRegistry('NOT_LOADED');
    const renderCount = { value: 0 };

    renderHook(() => {
      renderCount.value++;
      return useAppStatus(registry, 'test-app');
    });

    const initialRenders = renderCount.value;

    act(() => {
      registry.simulateChange('other-app', 'MOUNTED');
    });

    expect(renderCount.value).toStrictEqual(initialRenders);
  });

  it('등록되지 않은 앱은 NOT_LOADED를 반환한다', () => {
    const registry = createMockRegistry();

    const { result } = renderHook(() => useAppStatus(registry, 'nonexistent'));

    expect(result.current).toStrictEqual('NOT_LOADED');
  });
});
