import { useEffect, type ReactNode } from 'react';
import type { MfeApp, MfeAppStatus } from '@esmap/shared';
import { useParcel } from './hooks.js';

/** EsmapParcel component props */
export interface EsmapParcelProps {
  /** MfeApp or async loader to mount */
  readonly app: MfeApp | (() => Promise<MfeApp>);
  /** Props to pass to the app */
  readonly appProps?: Readonly<Record<string, unknown>>;
  /** Loading UI to display while the parcel is mounting */
  readonly loading?: ReactNode;
  /** Error UI to display when parcel mounting fails */
  readonly errorFallback?: (error: Error) => ReactNode;
  /** className to apply to the container div */
  readonly className?: string;
  /** Callback for parcel status changes */
  readonly onStatusChange?: (status: MfeAppStatus) => void;
}

/**
 * Declaratively mounts an esmap Parcel within a React component tree.
 * Internally uses the useParcel hook and automatically cleans up the Parcel on component unmount.
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
