import { useRef, useEffect, useSyncExternalStore, useCallback, useState } from 'react';
import { mountParcel, type Parcel } from '@esmap/runtime';
import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import type { GlobalState } from '@esmap/communication';

/**
 * esmap Parcel을 명령적으로 마운트하는 훅.
 * ref를 DOM 요소에 연결하면 자동으로 마운트/정리한다.
 *
 * @example
 * ```tsx
 * function Widget() {
 *   const { ref, status } = useParcel(() => import('@mfe/widget'), { theme: 'dark' });
 *   return <div ref={ref} />;
 * }
 * ```
 *
 * @param appOrLoader - MfeApp 또는 비동기 로더
 * @param props - 앱에 전달할 props
 * @returns ref와 현재 상태
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

  // props 변경 시 update
  useEffect(() => {
    if (parcelRef.current && props && status === 'MOUNTED') {
      void parcelRef.current.update(props);
    }
  }, [props, status]);

  return { ref, status, error };
}

/**
 * esmap GlobalState를 React 상태로 구독하는 훅.
 * useSyncExternalStore를 사용하여 concurrent mode에서 안전하다.
 *
 * 주의: selector 없이 사용하면 상태 변경 시 항상 리렌더링된다.
 * 특정 키만 필요하면 selector를 사용하여 원시값을 반환해야 불필요한 리렌더링을 방지한다.
 *
 * @example
 * ```tsx
 * const state = useGlobalState(globalState);
 * // 또는 selector로 특정 키만:
 * const theme = useGlobalState(globalState, s => s.theme);
 * ```
 *
 * @param store - esmap GlobalState 인스턴스
 * @param selector - 상태에서 필요한 부분만 추출하는 셀렉터
 * @returns 현재 상태 또는 선택된 값
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
  // 스냅샷 캐시 — subscribe 콜백에서만 갱신하여 useSyncExternalStore가
  // 매 호출마다 새 레퍼런스를 받는 것을 방지한다 (infinite loop 방지)
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

        // selector가 원시값을 반환하면 === 비교로 불필요한 리렌더링 방지
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
 * esmap AppRegistry의 앱 상태를 구독하는 훅.
 *
 * @example
 * ```tsx
 * const status = useAppStatus(registry, 'checkout');
 * if (status === 'MOUNTED') { ... }
 * ```
 *
 * @param registry - AppRegistry 인스턴스
 * @param appName - 감시할 앱 이름
 * @returns 현재 앱 상태
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
