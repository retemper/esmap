import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalState, useAppStatus } from './hooks.js';
import { createGlobalState } from '@esmap/communication';
import type { MfeAppStatus } from '@esmap/shared';

describe('useGlobalState', () => {
  it('returns the current global state', () => {
    const store = createGlobalState({ count: 0, name: 'test' });

    const { result } = renderHook(() => useGlobalState(store));

    expect(result.current).toStrictEqual({ count: 0, name: 'test' });
  });

  it('re-renders on state change', () => {
    const store = createGlobalState({ count: 0 });

    const { result } = renderHook(() => useGlobalState(store));

    act(() => {
      store.setState({ count: 42 });
    });

    expect(result.current).toStrictEqual({ count: 42 });
  });

  it('extracts a specific value using a selector', () => {
    const store = createGlobalState({ count: 0, name: 'test' });

    const { result } = renderHook(() => useGlobalState(store, (s) => s.count));

    expect(result.current).toStrictEqual(0);
  });

  it('does not re-render on unrelated key changes when using a selector', () => {
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

    // No re-render since count did not change (useSyncExternalStore compares snapshots)
    // Note: the state object itself is newly created, so without a selector it always re-renders
    // When the selector returns a primitive, === comparison skips re-render
    expect(renderCount.value).toStrictEqual(initialRenders);
  });
});

describe('useAppStatus', () => {
  /** Creates a mock registry for testing */
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
      /** Simulates a status change */
      simulateChange(appName: string, to: MfeAppStatus) {
        const app = apps.get(appName);
        if (app) app.status = to;
        for (const listener of listeners) {
          listener({ appName, to });
        }
      },
    };
  }

  it('returns the current status of an app', () => {
    const registry = createMockRegistry('MOUNTED');

    const { result } = renderHook(() => useAppStatus(registry, 'test-app'));

    expect(result.current).toStrictEqual('MOUNTED');
  });

  it('re-renders on status change', () => {
    const registry = createMockRegistry('NOT_LOADED');

    const { result } = renderHook(() => useAppStatus(registry, 'test-app'));

    expect(result.current).toStrictEqual('NOT_LOADED');

    act(() => {
      registry.simulateChange('test-app', 'MOUNTED');
    });

    expect(result.current).toStrictEqual('MOUNTED');
  });

  it('ignores status changes from other apps', () => {
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

  it('returns NOT_LOADED for an unregistered app', () => {
    const registry = createMockRegistry();

    const { result } = renderHook(() => useAppStatus(registry, 'nonexistent'));

    expect(result.current).toStrictEqual('NOT_LOADED');
  });
});
