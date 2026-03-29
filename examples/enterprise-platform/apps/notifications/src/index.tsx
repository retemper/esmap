/**
 * Notifications MFE — 크로스-MFE 이벤트 수집 및 알림 센터 시연.
 *
 * 시연 포인트:
 * - window CustomEvent 구독으로 다른 MFE 이벤트를 수집
 * - 알림 목록 집계 (최대 20개, 최신순)
 * - 읽지 않은 알림 배지 및 토스트 애니메이션
 * - 알림 클릭 시 esmap:notification:click 이벤트 발행
 */
import { createReactMfeApp } from '@esmap/react';
import { NotificationCenter } from './NotificationCenter.js';

export default createReactMfeApp({
  rootComponent: NotificationCenter,
});
