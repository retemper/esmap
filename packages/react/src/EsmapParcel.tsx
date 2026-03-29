import { useEffect, type ReactNode } from 'react';
import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { useParcel } from './hooks.js';

/** EsmapParcel 컴포넌트 props */
export interface EsmapParcelProps {
  /** 마운트할 MfeApp 또는 비동기 로더 */
  readonly app: MfeApp | (() => Promise<MfeApp>);
  /** 앱에 전달할 props */
  readonly appProps?: Readonly<Record<string, unknown>>;
  /** Parcel 마운트 중 표시할 로딩 UI */
  readonly loading?: ReactNode;
  /** Parcel 마운트 실패 시 표시할 에러 UI */
  readonly errorFallback?: (error: Error) => ReactNode;
  /** 컨테이너 div에 적용할 className */
  readonly className?: string;
  /** Parcel 상태 변경 콜백 */
  readonly onStatusChange?: (status: MfeAppStatus) => void;
}

/**
 * React 컴포넌트 트리 안에서 esmap Parcel을 선언적으로 마운트한다.
 * 내부적으로 useParcel 훅을 사용하며, 컴포넌트 언마운트 시 자동으로 Parcel을 정리한다.
 *
 * @example
 * ```tsx
 * <EsmapParcel
 *   app={() => import('@mfe/widget')}
 *   appProps={{ theme: 'dark' }}
 *   loading={<Spinner />}
 * />
 * ```
 */
export function EsmapParcel({
  app,
  appProps,
  loading,
  errorFallback,
  className,
  onStatusChange,
}: EsmapParcelProps): ReactNode {
  const { ref, status, error } = useParcel(app, appProps);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  if (status === 'LOAD_ERROR' && error && errorFallback) {
    return errorFallback(error);
  }

  return (
    <>
      {(status === 'NOT_LOADED' || status === 'LOADING') && loading}
      <div ref={ref} className={className} />
    </>
  );
}
