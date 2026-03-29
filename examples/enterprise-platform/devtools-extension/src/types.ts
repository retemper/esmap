/**
 * esmap DevTools Extension — 공유 메시지 프로토콜.
 *
 * Content script, background service worker, panel 간
 * 메시지 타입을 정의한다.
 */

/** 앱 정보 */
export interface AppInfo {
  readonly name: string;
  readonly status: string;
  readonly container: string;
}

/** 이벤트 카테고리 */
export type EventCategory = 'lifecycle' | 'auth' | 'route' | 'state' | 'error' | 'all';

/** 전환 통계 */
export interface TransitionStats {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly ratio: number;
}

/** Page → Panel 방향 메시지 (page postMessage → content-script → background → panel) */
export type PageToPanel =
  | { type: 'ESMAP_INIT'; apps: AppInfo[]; currentState: Record<string, unknown>; prefetchStats: TransitionStats[] }
  | { type: 'ESMAP_STATUS_CHANGE'; appName: string; from: string; to: string; timestamp: number }
  | { type: 'ESMAP_EVENT'; event: string; payload: string; category: EventCategory; appName?: string; timestamp: number }
  | { type: 'ESMAP_STATE_CHANGE'; newState: Record<string, unknown>; prevState: Record<string, unknown>; timestamp: number }
  | { type: 'ESMAP_ROUTE_CHANGE'; from: string; to: string; timestamp: number }
  | { type: 'ESMAP_PERF'; appName: string; phase: string; duration: number; startTime: number; timestamp: number }
  | { type: 'ESMAP_PREFETCH_STATS'; stats: TransitionStats[]; timestamp: number }
  | { type: 'ESMAP_LOG'; message: string; timestamp: number };

/** Panel → Page 방향 메시지 (panel → background → content-script → page postMessage) */
export type PanelToPage =
  | { type: 'ESMAP_GET_SNAPSHOT' };

/** window.postMessage 봉투 */
export interface MessageEnvelope {
  readonly source: 'esmap-devtools' | 'esmap-devtools-panel';
  readonly payload: PageToPanel | PanelToPage;
}

/** Chrome extension port 메시지 */
export interface PortMessage {
  readonly tabId?: number;
  readonly payload: PageToPanel | PanelToPage;
}
