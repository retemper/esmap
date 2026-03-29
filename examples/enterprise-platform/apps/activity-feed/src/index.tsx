/**
 * Activity Feed MFE — 듀얼 모드 (라우트 + Parcel) 시연.
 *
 * 시연 포인트:
 * - 동일한 React 컴포넌트가 라우트 MFE로도, Parcel 위젯으로도 동작
 * - props.mode로 표시 모드 결정: 'page' (전체 페이지) vs 'widget' (임베드)
 * - createReactMfeApp의 update 라이프사이클로 Parcel props 수신
 */
import { createReactMfeApp } from '@esmap/react';
import { Feed } from './Feed.js';

export default createReactMfeApp({
  rootComponent: Feed,
});
