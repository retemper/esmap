/**
 * Task Board MFE — 칸반 보드 + 이벤트 기반 MFE 간 통신 시연.
 *
 * 시연 포인트:
 * - CustomEvent로 MFE 간 느슨한 결합 통신 (task:select, task:status-change)
 * - 외부 이벤트 구독 (team:member-select, notification:click)
 * - EsmapParcel로 activity-feed를 태스크 상세 패널에 임베드
 * - @enterprise/design-system 컴포넌트를 import map으로 소비
 */
import { createReactMfeApp } from '@esmap/react';
import { TaskBoard } from './TaskBoard.js';

export default createReactMfeApp({
  rootComponent: TaskBoard,
});
