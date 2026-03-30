import { useRef, useEffect, useSyncExternalStore, useCallback, useState } from 'react';
import { mountParcel, type Parcel } from '@esmap/runtime';
import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import type { GlobalState } from '@esmap/communication';

/**
 * Hook for imperatively mounting an esmap Parcel.
 * Attach the ref to a DOM element to automatically mount/cleanup.
 *
 * @example
 * ```tsx
 * function Widget() {
 *   const { ref, status } = useParcel(() => import('@mfe/widget'), { theme: 'dark' });
 *   return <div ref={ref} />;
 * }
 * ```
 *
 * @param appOrLoader - MfeApp or async loader
 * @param props - props to pass to the app
 * @returns ref and current status
 */
export function useParcel(
  appOrLoader: MfeApp | (() => Promise<MfeApp>),
  props?: Readonly<Record<string, unknown>>,
): { ref: React.RefObject<HTMLDivElement | null>; status: MfeAppStatus; error: Error | null } {
  const ref = useRef<HTMLDivElement | null>(null);
  const parcelRef = useRef<Parcel | null>(null);
  const [status, setStatus] = useState<MfeAppStatus>('NOT_LOADED');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const aborted = { value: false };

    const init = async (): Promise<void> => {
      setStatus('LOADING');
      try {
        const parcel = await mountParcel({
          app: appOrLoader,
          domElement: container,
          props,
        });

        if (aborted.value) {
          await parcel.unmount();
          return;
        }

        parcelRef.current = parcel;
        setStatus('MOUNTED');
      } catch (err) {
        if (aborted.value) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('LOAD_ERROR');
      }
    };

    void init();

    return () => {
      aborted.value = true;
      if (parcelRef.current) {
        void parcelRef.current.unmount();
        parcelRef.current = null;
        setStatus('NOT_MOUNTED');
      }
    };
  }, [appOrLoader]);

  // Update on props change
  useEffect(() => {
    if (parcelRef.current && props && status === 'MOUNTED') {
      void parcelRef.current.update(props);
    }
  }, [props, status]);

  return { ref, status, error };
}

/**
 * Hook for subscribing to esmap GlobalState as React state.
 * Uses useSyncExternalStore for safety in concurrent mode.
 *
 * Note: without a selector, every state change triggers a re-render.
 * If only specific keys are needed, use a selector returning primitives to avoid unnecessary re-renders.
 *
 * @example
 * ```tsx
 * const state = useGlobalState(globalState);
 * // Or select specific keys with a selector:
 * const theme = useGlobalState(globalState, s => s.theme);
 * ```
 *
 * @param store - esmap GlobalState instance
 * @param selector - selector to extract only the needed part of the state
 * @returns current state or selected value
 */
export function useGlobalState<T extends Record<string, unknown>>(
  store: GlobalState<T>,
): Readonly<T>;
export function useGlobalState<T extends Record<string, unknown>, S>(
  store: GlobalState<T>,
  selector: (state: Readonly<T>) => S,
): S;
export function useGlobalState<T extends Record<string, unknown>, S>(
  store: GlobalState<T>,
  selector?: (state: Readonly<T>) => S,
): Readonly<T> | S {
  // Snapshot cache -- updated only in subscribe callback to prevent
  // useSyncExternalStore from receiving a new reference on every call (prevents infinite loop)
  const cacheRef = useRef<{ state: Readonly<T>; selected: Readonly<T> | S }>({
    state: store.getState(),
    selected: selector ? selector(store.getState()) : store.getState(),
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store.subscribe((newState) => {
        const prevSelected = cacheRef.current.selected;
        const nextSelected = selector ? selector(newState) : newState;

        cacheRef.current = { state: newState, selected: nextSelected };

        // When selector returns a primitive, === comparison prevents unnecessary re-renders
        if (!Object.is(prevSelected, nextSelected)) {
          onStoreChange();
        }
      }),
    [store, selector],
  );

  const getSnapshot = useCallback(() => cacheRef.current.selected, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook for subscribing to app status from the esmap AppRegistry.
 *
 * @example
 * ```tsx
 * const status = useAppStatus(registry, 'checkout');
 * if (status === 'MOUNTED') { ... }
 * ```
 *
 * @param registry - AppRegistry instance
 * @param appName - name of the app to watch
 * @returns current app status
 */
export function useAppStatus(
  registry: {
    onStatusChange: (
      listener: (event: { appName: string; to: MfeAppStatus }) => void,
    ) => () => void;
    getApp: (name: string) => { status: MfeAppStatus } | undefined;
  },
  appName: string,
): MfeAppStatus {
  const cacheRef = useRef<MfeAppStatus>(registry.getApp(appName)?.status ?? 'NOT_LOADED');

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      registry.onStatusChange((event) => {
        if (event.appName === appName) {
          cacheRef.current = event.to;
          onStoreChange();
        }
      }),
    [registry, appName],
  );

  const getSnapshot = useCallback(() => cacheRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
