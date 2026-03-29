/**
 * Dashboard MFE — 중첩 Parcel + 공유 디자인 시스템 시연.
 *
 * 시연 포인트:
 * - EsmapParcel로 activity-feed를 위젯으로 임베드 (중첩 MFE)
 * - useGlobalState로 인증 상태 구독
 * - @enterprise/design-system 컴포넌트를 import map으로 소비
 */
import { createReactMfeApp } from '@esmap/react';
import { Dashboard } from './Dashboard.js';

export default createReactMfeApp({
  rootComponent: Dashboard,
});
