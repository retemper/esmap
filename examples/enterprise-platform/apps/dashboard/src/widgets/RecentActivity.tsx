import type { ReactNode } from 'react';
import { EsmapParcel } from '@esmap/react';
import type { MfeApp } from '@esmap/shared';

/**
 * Activity Feed MFE를 비동기 로드하여 MfeApp을 반환한다.
 * default export를 추출하여 EsmapParcel이 기대하는 타입에 맞춘다.
 */
async function loadActivityFeed(): Promise<MfeApp> {
  const mod = await import(/* @vite-ignore */ '@enterprise/activity-feed');
  return mod.default;
}

/**
 * 최근 활동 위젯.
 * EsmapParcel을 사용하여 activity-feed MFE를 중첩 Parcel로 마운트한다.
 *
 * 시연 포인트:
 * - MFE-in-MFE: Dashboard 안에 activity-feed를 Parcel로 삽입
 * - 비동기 로더: () => import('@enterprise/activity-feed') 패턴
 * - loading/error 바운더리 선언적 처리
 * - appProps를 통한 부모→자식 Parcel 데이터 전달
 */
export function RecentActivity(): ReactNode {
  return (
    <EsmapParcel
      app={loadActivityFeed}
      appProps={{ mode: 'widget', maxItems: 5 }}
      loading={
        <div style={{ padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
          Activity Feed 로드 중...
        </div>
      }
      errorFallback={(error) => (
        <div style={{ padding: '16px', color: '#dc2626', fontSize: '13px' }}>
          Activity Feed 로드 실패: {error.message}
        </div>
      )}
      className="activity-widget"
    />
  );
}
