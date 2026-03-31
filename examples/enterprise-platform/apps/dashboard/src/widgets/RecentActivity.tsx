import type { ReactNode } from 'react';
import { EsmapParcel } from '@esmap/react';
import type { MfeApp } from '@esmap/shared';

/**
 * Asynchronously loads the Activity Feed MFE and returns its MfeApp.
 * Extracts the default export to match the type expected by EsmapParcel.
 */
async function loadActivityFeed(): Promise<MfeApp> {
  const mod = await import(/* @vite-ignore */ '@enterprise/activity-feed');
  return mod.default;
}

/**
 * Recent activity widget.
 * Mounts the activity-feed MFE as a nested Parcel using EsmapParcel.
 *
 * Demo points:
 * - MFE-in-MFE: embeds activity-feed as a Parcel inside Dashboard
 * - Async loader: () => import('@enterprise/activity-feed') pattern
 * - Declarative loading/error boundary handling
 * - Parent-to-child Parcel data passing via appProps
 */
export function RecentActivity(): ReactNode {
  return (
    <EsmapParcel
      app={loadActivityFeed}
      appProps={{ mode: 'widget', maxItems: 5 }}
      loading={
        <div style={{ padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
          Loading Activity Feed...
        </div>
      }
      errorFallback={(error) => (
        <div style={{ padding: '16px', color: '#dc2626', fontSize: '13px' }}>
          Failed to load Activity Feed: {error.message}
        </div>
      )}
      className="activity-widget"
    />
  );
}
