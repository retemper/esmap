/**
 * Enterprise Platform DevTools Panel.
 *
 * SVG 토폴로지, 이벤트 스트림, 상태 인스펙터, 통신 플로우를 포함하는
 * 자립형(self-contained) 바닐라 TypeScript DevTools 위젯.
 *
 * v2: 이벤트 플로우 애니메이션, 노드 글로우, 방향 화살표,
 *     전환 확률 엣지, 프리페치 표시기, Flow 탭 추가.
 */

// ─── Types ───

/** 앱 상태 문자열 */
type AppStatus = 'MOUNTED' | 'FROZEN' | 'NOT_LOADED' | 'LOADING' | 'LOAD_ERROR' | 'BOOTSTRAPPING' | 'NOT_MOUNTED' | 'UNMOUNTING';

/** 앱 정보 */
interface AppInfo {
  readonly name: string;
  readonly status: string;
  readonly container: string;
}

/**
 * 이벤트 버스 핸들.
 * 제네릭 EventBus<T>와 호환되기 위해 넓은 시그니처를 사용한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EventBusHandle {
  readonly getHistory: (event?: string) => ReadonlyArray<{ event: string; payload: unknown; timestamp: number }>;
  readonly on: (event: string, handler: (...args: any[]) => void, options?: unknown) => unknown;
}

/** 글로벌 상태 핸들 */
interface GlobalStateHandle {
  readonly getState: () => Record<string, unknown>;
  readonly subscribe: (cb: (newState: Record<string, unknown>, prevState: Record<string, unknown>) => void) => void;
}

/** 앱 레지스트리 핸들 */
interface RegistryHandle {
  readonly getApps: () => ReadonlyArray<AppInfo>;
  readonly onStatusChange: (cb: (event: { appName: string; from: string; to: string }) => void) => void;
}

/** 라우터 핸들 */
interface RouterHandle {
  readonly afterRouteChange: (cb: (from: { pathname: string }, to: { pathname: string }) => void) => void;
}

/** 성능 핸들 */
interface PerfHandle {
  readonly summarize: () => ReadonlyMap<string, { readonly total: number; readonly phases: Record<string, number> }>;
  readonly onMeasurement?: (listener: (m: { appName: string; phase: string; duration: number; startTime: number }) => void) => () => void;
}

/** 프리페치 컨트롤러 핸들 */
interface PrefetchHandle {
  readonly getStats: () => ReadonlyArray<{ from: string; to: string; count: number; ratio: number }>;
  readonly getPriorities: (currentApp: string) => ReadonlyArray<{ appName: string; probability: number }>;
  readonly historySize: number;
}

/** 공유 모듈 레지스트리 핸들 */
interface SharedModulesHandle {
  readonly getRegistered: () => ReadonlyMap<string, ReadonlyArray<{ name: string; version: string; requiredVersion?: string; singleton?: boolean; eager?: boolean; from?: string }>>;
  readonly getLoaded: () => ReadonlyMap<string, { version: string; from?: string }>;
}

/** Import Map 데이터 핸들 */
interface ImportMapHandle {
  readonly imports: Readonly<Record<string, string>>;
  readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** DevTools 패널 설정 */
interface DevtoolsPanelConfig {
  readonly registry: RegistryHandle;
  readonly eventBus: EventBusHandle;
  readonly globalState: GlobalStateHandle;
  readonly router: RouterHandle;
  readonly perf: PerfHandle;
  readonly prefetch?: PrefetchHandle;
  readonly sharedModules?: SharedModulesHandle;
  readonly importMap?: ImportMapHandle;
  readonly container?: string;
}

/** 이벤트 카테고리 */
type EventCategory = 'lifecycle' | 'auth' | 'route' | 'state' | 'error' | 'all';

/** 이벤트 항목 */
interface EventEntry {
  readonly timestamp: number;
  readonly category: EventCategory;
  readonly name: string;
  readonly detail: string;
  readonly appName?: string;
}

/** 상태 변경 이력 */
interface StateChangeEntry {
  readonly timestamp: number;
  readonly diff: ReadonlyArray<{ key: string; oldValue: unknown; newValue: unknown }>;
}

/** 앱 간 통신 플로우 항목 (Flow 탭용) */
interface FlowEntry {
  readonly timestamp: number;
  readonly from: string;
  readonly to: string;
  readonly event: string;
  readonly category: EventCategory;
}

/** DevTools 패널 퍼블릭 핸들 */
interface DevtoolsPanel {
  /** 외부에서 로그를 추가한다 */
  readonly log: (message: string) => void;
  /** 패널을 파괴한다 */
  readonly destroy: () => void;
}

// ─── Constants ───

/** 앱 상태별 색상 */
const STATUS_COLORS: Record<string, string> = {
  MOUNTED: '#4ade80',
  FROZEN: '#fbbf24',
  NOT_LOADED: '#6b7280',
  LOADING: '#60a5fa',
  BOOTSTRAPPING: '#60a5fa',
  NOT_MOUNTED: '#fb923c',
  LOAD_ERROR: '#f87171',
  UNMOUNTING: '#fb923c',
};

/** 이벤트 카테고리별 색상 */
const CATEGORY_COLORS: Record<EventCategory, string> = {
  lifecycle: '#4ade80',
  auth: '#c084fc',
  route: '#38bdf8',
  state: '#fbbf24',
  error: '#f87171',
  all: '#94a3b8',
};

/** 이벤트 카테고리별 라벨 */
const CATEGORY_LABELS: Record<EventCategory, string> = {
  lifecycle: 'Lifecycle',
  auth: 'Auth',
  route: 'Route',
  state: 'State',
  error: 'Error',
  all: 'All',
};

/** 토폴로지에서 사용하는 앱별 단축명 및 위치 정보 */
const APP_TOPOLOGY: ReadonlyArray<{
  name: string;
  short: string;
  container: string;
  angle: number;
  icon: string;
}> = [
  { name: '@enterprise/auth', short: 'Auth', container: '#app-auth', angle: -120, icon: '🔑' },
  { name: '@enterprise/dashboard', short: 'Dashboard', container: '#app-dashboard', angle: -60, icon: '📊' },
  { name: '@enterprise/task-board', short: 'Tasks', container: '#app-main', angle: 0, icon: '📝' },
  { name: '@enterprise/team-directory', short: 'Team', container: '#app-team', angle: 60, icon: '👥' },
  { name: '@enterprise/activity-feed', short: 'Activity', container: '#app-main', angle: 120, icon: '📋' },
  { name: '@enterprise/notifications', short: 'Notif', container: '#app-main', angle: 170, icon: '🔔' },
  { name: '@enterprise/legacy-settings', short: 'Settings', container: '#app-main', angle: -170, icon: '⚙' },
];

/** dashboard → activity-feed Parcel 관계 */
const PARCEL_EDGES: ReadonlyArray<{ from: string; to: string }> = [
  { from: '@enterprise/dashboard', to: '@enterprise/activity-feed' },
  { from: '@enterprise/task-board', to: '@enterprise/activity-feed' },
];

/** 패널 CSS 문자열 */
const PANEL_CSS = `
  #esmap-devtools {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 320px;
    background: #0d1117;
    color: #e6edf3;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 11px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -2px 20px rgba(0,0,0,0.6);
    transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    border-top: 1px solid #21262d;
  }
  #esmap-devtools.collapsed {
    height: 32px;
  }
  #esmap-devtools.collapsed .devtools-body { display: none; }

  .devtools-resize {
    height: 5px;
    cursor: ns-resize;
    background: transparent;
    flex-shrink: 0;
    position: relative;
  }
  .devtools-resize::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 3px;
    border-radius: 2px;
    background: #30363d;
    transition: background 0.15s;
  }
  .devtools-resize:hover::after {
    background: #58a6ff;
  }

  .devtools-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: #161b22;
    border-bottom: 1px solid #21262d;
    flex-shrink: 0;
    user-select: none;
  }
  .devtools-header-indicator {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #3fb950;
    box-shadow: 0 0 6px rgba(63,185,80,0.5);
    animation: dt-pulse 2s ease infinite;
  }
  @keyframes dt-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .devtools-title {
    font-size: 11px;
    font-weight: 700;
    color: #58a6ff;
    letter-spacing: 0.3px;
  }
  .devtools-tabs {
    display: flex;
    gap: 1px;
    margin-left: 16px;
    background: #21262d;
    border-radius: 6px;
    padding: 2px;
  }
  .devtools-tab {
    padding: 4px 14px;
    background: transparent;
    border: none;
    color: #7d8590;
    font-family: inherit;
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
    font-weight: 500;
  }
  .devtools-tab:hover { color: #e6edf3; }
  .devtools-tab.active { color: #e6edf3; background: #30363d; }
  .devtools-spacer { flex: 1; }
  .devtools-log-count {
    color: #7d8590;
    font-size: 10px;
  }
  .devtools-collapse-btn {
    background: none;
    border: none;
    color: #7d8590;
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
    transition: transform 0.25s;
  }
  #esmap-devtools.collapsed .devtools-collapse-btn {
    transform: rotate(180deg);
  }

  .devtools-body {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  .devtools-panel {
    position: absolute;
    inset: 0;
    overflow: auto;
    display: none;
  }
  .devtools-panel.active { display: block; }

  /* ─── Topology Tab ─── */
  .topo-container { position: relative; width: 100%; height: 100%; }
  .topo-svg { width: 100%; height: 100%; }
  .topo-node { cursor: pointer; }
  .topo-node:hover .topo-node-bg { filter: brightness(1.4); }
  .topo-node-bg {
    rx: 10;
    ry: 10;
    stroke-width: 1.5;
    transition: filter 0.15s, stroke-width 0.2s;
  }
  .topo-label {
    font-family: 'SF Mono', monospace;
    font-size: 10px;
    fill: #e6edf3;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
    font-weight: 600;
  }
  .topo-sublabel {
    font-family: 'SF Mono', monospace;
    font-size: 8px;
    fill: #7d8590;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
  .topo-status-dot {
    transition: fill 0.3s, r 0.2s;
  }
  .topo-edge {
    stroke: #21262d;
    stroke-width: 1.5;
    fill: none;
    transition: stroke 0.3s, stroke-width 0.3s;
  }
  .topo-edge-parcel {
    stroke: #8b5cf6;
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
    fill: none;
  }
  .topo-edge-prefetch {
    stroke: #1f6feb;
    stroke-width: 1;
    stroke-dasharray: 3 3;
    fill: none;
    opacity: 0.5;
  }
  .topo-host {
    fill: #161b22;
    stroke: #58a6ff;
    stroke-width: 2;
  }
  .topo-host-label {
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    fill: #58a6ff;
    text-anchor: middle;
    dominant-baseline: central;
    font-weight: 700;
    pointer-events: none;
  }
  .topo-tooltip {
    position: absolute;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 11px;
    color: #e6edf3;
    pointer-events: none;
    z-index: 10;
    display: none;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  .topo-tooltip-title { font-weight: 700; margin-bottom: 6px; font-size: 12px; }
  .topo-tooltip-row { display: flex; gap: 8px; padding: 1px 0; }
  .topo-tooltip-label { color: #7d8590; min-width: 60px; }
  .topo-tooltip-value { color: #e6edf3; }
  .topo-active-ring {
    fill: none;
    stroke: #58a6ff;
    stroke-width: 2;
    stroke-dasharray: 5 3;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .topo-active-ring.visible {
    opacity: 1;
    animation: topo-ring-rotate 8s linear infinite;
  }
  @keyframes topo-ring-rotate {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: -50; }
  }
  .topo-legend {
    position: absolute;
    bottom: 8px;
    left: 12px;
    display: flex;
    gap: 12px;
    font-size: 9px;
    color: #7d8590;
  }
  .topo-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .topo-legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .topo-perf-bar {
    transition: width 0.3s ease;
  }
  /* 노드 글로우 애니메이션 */
  @keyframes node-glow {
    0% { opacity: 0; }
    30% { opacity: 0.8; }
    100% { opacity: 0; }
  }
  /* 이벤트 플로우 파티클 */
  @keyframes flow-particle {
    from { offset-distance: 0%; opacity: 1; }
    to { offset-distance: 100%; opacity: 0; }
  }

  /* ─── Events Tab ─── */
  .events-container { display: flex; flex-direction: column; height: 100%; }
  .events-toolbar {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid #21262d;
    flex-shrink: 0;
    align-items: center;
  }
  .events-filter-btn {
    padding: 3px 10px;
    border: 1px solid #30363d;
    border-radius: 12px;
    background: transparent;
    color: #7d8590;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-weight: 500;
  }
  .events-filter-btn:hover { border-color: #484f58; color: #e6edf3; }
  .events-filter-btn.active {
    border-color: currentColor;
    background: rgba(255,255,255,0.04);
  }
  .events-clear-btn {
    margin-left: auto;
    padding: 3px 8px;
    border: 1px solid #30363d;
    border-radius: 6px;
    background: transparent;
    color: #7d8590;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  .events-clear-btn:hover { color: #f85149; border-color: #f85149; }
  .events-list {
    flex: 1;
    overflow-y: auto;
    padding: 2px 0;
  }
  .events-list::-webkit-scrollbar { width: 4px; }
  .events-list::-webkit-scrollbar-track { background: transparent; }
  .events-list::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
  .event-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 12px;
    animation: event-slide-in 0.2s ease;
    font-size: 11px;
  }
  .event-entry:hover { background: rgba(255,255,255,0.02); }
  @keyframes event-slide-in {
    from { opacity: 0; transform: translateX(8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .event-time {
    color: #484f58;
    font-size: 10px;
    flex-shrink: 0;
    min-width: 68px;
    font-variant-numeric: tabular-nums;
  }
  .event-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    border-radius: 10px;
    font-size: 9px;
    font-weight: 600;
    flex-shrink: 0;
    min-width: 56px;
    justify-content: center;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .event-name {
    color: #e6edf3;
    flex-shrink: 0;
    font-weight: 500;
  }
  .event-detail {
    color: #7d8590;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  /* ─── State Tab ─── */
  .state-container {
    display: flex;
    height: 100%;
  }
  .state-current {
    flex: 1;
    padding: 10px 14px;
    overflow-y: auto;
    border-right: 1px solid #21262d;
  }
  .state-current::-webkit-scrollbar { width: 4px; }
  .state-current::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
  .state-history {
    width: 300px;
    padding: 10px 14px;
    overflow-y: auto;
  }
  .state-history::-webkit-scrollbar { width: 4px; }
  .state-history::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
  .state-section-title {
    color: #7d8590;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
    font-weight: 600;
  }
  .state-tree { line-height: 1.7; }
  .state-key { color: #d2a8ff; }
  .state-string { color: #a5d6ff; }
  .state-number { color: #ffa657; }
  .state-bool { color: #ff7b72; }
  .state-null { color: #484f58; font-style: italic; }
  .state-brace { color: #7d8590; }
  .state-diff-entry {
    padding: 6px 0;
    border-bottom: 1px solid #21262d;
  }
  .state-diff-time {
    color: #484f58;
    font-size: 10px;
    margin-bottom: 2px;
  }
  .state-diff-item { padding: 2px 0; }
  .state-diff-key { color: #ffa657; font-weight: 500; }
  .state-diff-old { color: #f85149; text-decoration: line-through; }
  .state-diff-new { color: #3fb950; }
  .state-diff-arrow { color: #484f58; margin: 0 6px; }

  /* ─── Flow Tab ─── */
  .flow-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .flow-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid #21262d;
    flex-shrink: 0;
  }
  .flow-header-label {
    color: #7d8590;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }
  .flow-stats {
    margin-left: auto;
    color: #7d8590;
    font-size: 10px;
  }
  .flow-canvas {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
  }
  .flow-canvas::-webkit-scrollbar { height: 4px; }
  .flow-canvas::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
  .flow-swimlanes {
    display: flex;
    flex-direction: column;
    min-width: 100%;
    height: 100%;
    position: relative;
  }
  .flow-lane {
    flex: 1;
    border-bottom: 1px solid #21262d;
    position: relative;
    display: flex;
    align-items: center;
    min-height: 36px;
  }
  .flow-lane-label {
    position: sticky;
    left: 0;
    width: 80px;
    min-width: 80px;
    padding: 0 8px;
    font-size: 9px;
    color: #7d8590;
    font-weight: 600;
    background: #0d1117;
    z-index: 2;
    text-align: right;
    border-right: 1px solid #21262d;
  }
  .flow-lane-content {
    flex: 1;
    position: relative;
    height: 100%;
  }
  .flow-event-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    top: 50%;
    transform: translateY(-50%);
    animation: flow-dot-appear 0.3s ease;
    cursor: pointer;
  }
  .flow-arrow-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .flow-event-dot:hover {
    transform: translateY(-50%) scale(1.6);
    z-index: 5;
  }
  @keyframes flow-dot-appear {
    from { transform: translateY(-50%) scale(0); opacity: 0; }
    to { transform: translateY(-50%) scale(1); opacity: 1; }
  }
  .flow-arrow {
    position: absolute;
    pointer-events: none;
    z-index: 1;
  }
  .flow-arrow line {
    stroke-width: 1.5;
    opacity: 0.6;
  }
  .flow-arrow-head {
    fill: currentColor;
    opacity: 0.6;
  }
  .flow-time-axis {
    position: absolute;
    top: 0;
    height: 100%;
    width: 1px;
    background: rgba(88,166,255,0.15);
    z-index: 1;
  }

  /* ─── Perf Waterfall ─── */
  .perf-container {
    padding: 12px 16px;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .perf-container::-webkit-scrollbar { width: 6px; }
  .perf-container::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
  .perf-title {
    color: #7d8590;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .perf-empty {
    color: #484f58;
    font-style: italic;
    padding: 20px 0;
    text-align: center;
  }
  .perf-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .perf-app-name {
    width: 80px;
    min-width: 80px;
    text-align: right;
    color: #e6edf3;
    font-weight: 600;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .perf-bar-container {
    flex: 1;
    height: 22px;
    position: relative;
    display: flex;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(255,255,255,0.02);
  }
  .perf-bar-segment {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    min-width: 2px;
    position: relative;
    transition: width 0.3s ease;
  }
  .perf-bar-segment:hover {
    filter: brightness(1.3);
  }
  .perf-total {
    width: 60px;
    min-width: 60px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    font-weight: 600;
  }
  .perf-legend {
    display: flex;
    gap: 16px;
    padding: 8px 0 4px;
    margin-top: 8px;
    border-top: 1px solid #21262d;
  }
  .perf-legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #7d8590;
  }
  .perf-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .perf-scale {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 88px;
    margin-bottom: 4px;
    font-size: 10px;
    color: #484f58;
    font-variant-numeric: tabular-nums;
  }
  .perf-scale-marker {
    flex: 1;
    text-align: center;
  }
`;

// ─── Helpers ───

/** 타임스탬프를 HH:MM:SS.mmm 형식으로 변환한다 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** 앱 이름에서 @enterprise/ 프리픽스를 제거한다 */
function shortName(name: string): string {
  return name.replace('@enterprise/', '');
}

/** 로그 메시지에서 이벤트 카테고리를 판별한다 */
function classifyMessage(message: string): EventCategory {
  if (message.includes('실패') || message.includes('에러') || message.includes('차단') || message.includes('오염')) return 'error';
  if (message.includes('라우트') || message.includes('route') || message.includes('404')) return 'route';
  if (message.includes('인증') || message.includes('로그아웃') || message.includes('auth')) return 'auth';
  if (message.includes('→') || message.includes('마운트') || message.includes('정리') || message.includes('앱 등록')) return 'lifecycle';
  if (message.includes('현재 앱') || message.includes('상태') || message.includes('테마')) return 'state';
  return 'lifecycle';
}

/** SVG 네임스페이스로 요소를 생성한다 */
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

/** JSON 값을 HTML로 렌더링한다 (트리 뷰) */
function renderJsonTree(value: unknown, indent: number = 0, isLast: boolean = true): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return `<span class="state-null">null</span>${isLast ? '' : ','}`;
  }
  if (typeof value === 'string') {
    return `<span class="state-string">"${escapeHtml(value)}"</span>${isLast ? '' : ','}`;
  }
  if (typeof value === 'number') {
    return `<span class="state-number">${value}</span>${isLast ? '' : ','}`;
  }
  if (typeof value === 'boolean') {
    return `<span class="state-bool">${value}</span>${isLast ? '' : ','}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `<span class="state-brace">[]</span>${isLast ? '' : ','}`;
    const items = value.map((item, i) =>
      `${pad}  ${renderJsonTree(item, indent + 1, i === value.length - 1)}`
    ).join('\n');
    return `<span class="state-brace">[</span>\n${items}\n${pad}<span class="state-brace">]</span>${isLast ? '' : ','}`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return `<span class="state-brace">{}</span>${isLast ? '' : ','}`;
    const items = entries.map(([k, v], i) =>
      `${pad}  <span class="state-key">"${escapeHtml(k)}"</span>: ${renderJsonTree(v, indent + 1, i === entries.length - 1)}`
    ).join('\n');
    return `<span class="state-brace">{</span>\n${items}\n${pad}<span class="state-brace">}</span>${isLast ? '' : ','}`;
  }
  return `<span class="state-null">${String(value)}</span>${isLast ? '' : ','}`;
}

/** HTML 특수문자를 이스케이프한다 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 두 점 사이의 앵글을 구한다 */
function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

// ─── Panel Creation ───

/**
 * DevTools 패널을 생성하고 DOM에 마운트한다.
 * boot.ts에서 esmap 생성 후 호출하여 모든 데이터 소스를 연결한다.
 * @param config - 데이터 소스와 설정
 */
export function createDevtoolsPanel(config: DevtoolsPanelConfig): DevtoolsPanel {
  const { registry, eventBus, globalState, router, perf, prefetch, sharedModules, importMap } = config;
  const containerId = config.container ?? '#esmap-devtools';

  // ─── 내부 상태 ───
  const events: EventEntry[] = [];
  const stateHistory: StateChangeEntry[] = [];
  const flows: FlowEntry[] = [];
  const MAX_EVENTS = 300;
  const MAX_STATE_HISTORY = 30;
  const MAX_FLOWS = 100;
  const activeFilter: { value: EventCategory } = { value: 'all' };
  const logCountRef = { value: 0 };
  /** 토폴로지 노드 글로우 타이머 */
  const glowTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  /** 엣지별 이벤트 카운터 */
  const edgeTraffic: Record<string, number> = {};

  // ─── Inject CSS ───
  const style = document.createElement('style');
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);

  // ─── Root ───
  const container = document.querySelector(containerId);
  if (!container) {
    throw new Error(`DevTools container not found: ${containerId}`);
  }
  const root = container instanceof HTMLElement ? container : document.createElement('div');
  root.id = 'esmap-devtools';
  root.innerHTML = '';

  // ─── Resize handle ───
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'devtools-resize';
  root.appendChild(resizeHandle);
  setupResize(resizeHandle, root);

  // ─── Header ───
  const header = document.createElement('div');
  header.className = 'devtools-header';
  header.innerHTML = `
    <span class="devtools-header-indicator"></span>
    <span class="devtools-title">esmap DevTools</span>
    <div class="devtools-tabs">
      <button class="devtools-tab active" data-tab="topology">Topology</button>
      <button class="devtools-tab" data-tab="flow">Flow</button>
      <button class="devtools-tab" data-tab="events">Events</button>
      <button class="devtools-tab" data-tab="state">State</button>
      <button class="devtools-tab" data-tab="perf">Perf</button>
      <button class="devtools-tab" data-tab="deps">Deps</button>
    </div>
    <span class="devtools-spacer"></span>
    <span class="devtools-log-count">0 events</span>
    <button class="devtools-collapse-btn">&#x25BC;</button>
  `;
  root.appendChild(header);

  const logCountEl = header.querySelector('.devtools-log-count') as HTMLElement;
  const collapseBtn = header.querySelector('.devtools-collapse-btn') as HTMLElement;

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    root.classList.toggle('collapsed');
  });

  // 탭 전환
  const tabs = header.querySelectorAll<HTMLButtonElement>('.devtools-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      showPanel(tab.dataset.tab ?? 'topology');
    });
  });

  // ─── Body ───
  const body = document.createElement('div');
  body.className = 'devtools-body';
  root.appendChild(body);

  // ─── Tab Panels ───
  const topologyPanel = document.createElement('div');
  topologyPanel.className = 'devtools-panel active';
  topologyPanel.dataset.panel = 'topology';
  body.appendChild(topologyPanel);

  const flowPanel = document.createElement('div');
  flowPanel.className = 'devtools-panel';
  flowPanel.dataset.panel = 'flow';
  flowPanel.style.display = 'none';
  body.appendChild(flowPanel);

  const eventsPanel = document.createElement('div');
  eventsPanel.className = 'devtools-panel';
  eventsPanel.dataset.panel = 'events';
  eventsPanel.style.display = 'none';
  eventsPanel.style.flexDirection = 'column';
  body.appendChild(eventsPanel);

  const statePanel = document.createElement('div');
  statePanel.className = 'devtools-panel';
  statePanel.dataset.panel = 'state';
  statePanel.style.display = 'none';
  body.appendChild(statePanel);

  const perfPanel = document.createElement('div');
  perfPanel.className = 'devtools-panel';
  perfPanel.dataset.panel = 'perf';
  perfPanel.style.display = 'none';
  body.appendChild(perfPanel);

  const depsPanel = document.createElement('div');
  depsPanel.className = 'devtools-panel';
  depsPanel.dataset.panel = 'deps';
  depsPanel.style.display = 'none';
  body.appendChild(depsPanel);

  /** 지정된 탭 패널을 활성화하고 나머지를 숨긴다 */
  function showPanel(name: string): void {
    body.querySelectorAll<HTMLElement>('.devtools-panel').forEach((p) => {
      const isTarget = p.dataset.panel === name;
      p.classList.toggle('active', isTarget);
      p.style.display = isTarget ? (['events', 'flow'].includes(name) ? 'flex' : 'block') : 'none';
    });
    if (name === 'topology') refreshTopology();
    if (name === 'state') refreshStateView();
    if (name === 'flow') refreshFlowView();
    if (name === 'perf') refreshPerfView();
    if (name === 'deps') refreshDepsView();
  }

  // ═══════════════════════════════════════════════
  // ─── TOPOLOGY PANEL ───
  // ═══════════════════════════════════════════════

  const topoContainer = document.createElement('div');
  topoContainer.className = 'topo-container';
  topologyPanel.appendChild(topoContainer);

  const topoTooltip = document.createElement('div');
  topoTooltip.className = 'topo-tooltip';
  topoContainer.appendChild(topoTooltip);

  const topoSvg = svgEl('svg', { width: '100%', height: '100%' });
  topoSvg.classList.add('topo-svg');
  topoContainer.appendChild(topoSvg);

  // 레전드
  const legend = document.createElement('div');
  legend.className = 'topo-legend';
  const legendItems: ReadonlyArray<{ label: string; color: string }> = [
    { label: 'Mounted', color: STATUS_COLORS.MOUNTED },
    { label: 'Frozen', color: STATUS_COLORS.FROZEN },
    { label: 'Not Loaded', color: STATUS_COLORS.NOT_LOADED },
    { label: 'Loading', color: STATUS_COLORS.LOADING },
    { label: 'Error', color: STATUS_COLORS.LOAD_ERROR },
  ];
  for (const item of legendItems) {
    const el = document.createElement('span');
    el.className = 'topo-legend-item';
    el.innerHTML = `<span class="topo-legend-dot" style="background:${item.color}"></span>${item.label}`;
    legend.appendChild(el);
  }
  // Parcel edge legend
  const parcelLegend = document.createElement('span');
  parcelLegend.className = 'topo-legend-item';
  parcelLegend.innerHTML = `<span style="width:16px;height:2px;background:#8b5cf6;border-radius:1px;display:inline-block"></span>Parcel`;
  legend.appendChild(parcelLegend);
  topoContainer.appendChild(legend);

  /** 현재 활성 앱을 추적한다 */
  const activeAppRef = { value: '' };
  /** 앱 상태 캐시 */
  const statusCache: Record<string, string> = {};
  /** 앱별 라이프사이클 단계 시작 시각 (성능 데이터 파생용) */
  const phaseStartTimes: Record<string, Record<string, number>> = {};
  /** 라이프사이클 이벤트에서 파생된 성능 데이터 */
  const derivedPerfData: Record<string, { total: number; phases: Record<string, number> }> = {};
  /** 노드 좌표 캐시 (토폴로지 외부에서도 접근) */
  const nodePositionsCache: Record<string, { x: number; y: number }> = {};
  /** 중심 좌표 캐시 */
  const centerCache = { x: 0, y: 0 };

  /** SVG 토폴로지 그래프를 다시 그린다 */
  function refreshTopology(): void {
    topoSvg.innerHTML = '';

    const rect = topoContainer.getBoundingClientRect();
    const width = rect.width || 900;
    const height = rect.height || 260;
    const cx = width / 2;
    const cy = height / 2;
    const radiusX = Math.min(width * 0.34, 320);
    const radiusY = Math.min(height * 0.34, 95);

    centerCache.x = cx;
    centerCache.y = cy;
    topoSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // ─── SVG Defs: 마커, 필터, 그라디언트 ───
    const defs = svgEl('defs');

    // 화살표 마커
    const arrowMarker = svgEl('marker', {
      id: 'arrow-marker',
      markerWidth: 8,
      markerHeight: 6,
      refX: 7,
      refY: 3,
      orient: 'auto',
    });
    const arrowPath = svgEl('path');
    arrowPath.setAttribute('d', 'M0,0 L8,3 L0,6 Z');
    arrowPath.setAttribute('fill', '#30363d');
    arrowMarker.appendChild(arrowPath);
    defs.appendChild(arrowMarker);

    // Parcel 화살표 마커
    const parcelArrowMarker = svgEl('marker', {
      id: 'parcel-arrow-marker',
      markerWidth: 8,
      markerHeight: 6,
      refX: 7,
      refY: 3,
      orient: 'auto',
    });
    const parcelArrowPath = svgEl('path');
    parcelArrowPath.setAttribute('d', 'M0,0 L8,3 L0,6 Z');
    parcelArrowPath.setAttribute('fill', '#8b5cf6');
    parcelArrowMarker.appendChild(parcelArrowPath);
    defs.appendChild(parcelArrowMarker);

    // 글로우 필터
    const glowFilter = svgEl('filter', { id: 'node-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    const feGaussianBlur = svgEl('feGaussianBlur', { stdDeviation: '4', result: 'blur' });
    glowFilter.appendChild(feGaussianBlur);
    const feMerge = svgEl('feMerge');
    const feMergeNode1 = svgEl('feMergeNode', { in: 'blur' });
    const feMergeNode2 = svgEl('feMergeNode', { in: 'SourceGraphic' });
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    glowFilter.appendChild(feMerge);
    defs.appendChild(glowFilter);

    topoSvg.appendChild(defs);

    // ─── 플러그인 뱃지 (상단) ───
    const pluginNames = ['guard', 'sandbox', 'keepAlive', 'domIsolation', 'prefetch', 'communication', 'audit'];
    const pluginY = 16;
    const pluginSpacing = 90;
    const pluginStartX = cx - ((pluginNames.length - 1) * pluginSpacing) / 2;

    for (const [i, name] of pluginNames.entries()) {
      const px = pluginStartX + i * pluginSpacing;
      const pillBg = svgEl('rect', {
        x: px - 34, y: pluginY - 8, width: 68, height: 16,
        rx: 8, ry: 8,
        fill: '#161b22', stroke: '#21262d', 'stroke-width': 1,
      });
      topoSvg.appendChild(pillBg);
      const pillText = svgEl('text', {
        x: px, y: pluginY,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: '#7d8590', 'font-size': '8', 'font-family': "'SF Mono', monospace",
      });
      pillText.textContent = name;
      topoSvg.appendChild(pillText);
    }

    // ─── Shared deps 뱃지 (하단) ───
    const sharedDeps = ['react ^19', 'react-dom ^19', '@enterprise/design-system ^1'];
    const sharedY = height - 14;
    const sharedSpacing = 120;
    const sharedStartX = cx - ((sharedDeps.length - 1) * sharedSpacing) / 2;

    for (const [i, dep] of sharedDeps.entries()) {
      const sx = sharedStartX + i * sharedSpacing;
      const pillBg = svgEl('rect', {
        x: sx - 50, y: sharedY - 8, width: 100, height: 16,
        rx: 8, ry: 8,
        fill: '#161b22', stroke: '#21262d', 'stroke-width': 1,
      });
      topoSvg.appendChild(pillBg);
      const pillText = svgEl('text', {
        x: sx, y: sharedY,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: '#484f58', 'font-size': '8', 'font-family': "'SF Mono', monospace",
      });
      pillText.textContent = dep;
      topoSvg.appendChild(pillText);
    }

    // ─── 앱별 좌표 계산 ───
    const apps = registry.getApps();
    const appStatusMap: Record<string, string> = {};
    for (const app of apps) {
      appStatusMap[app.name] = app.status;
      statusCache[app.name] = app.status;
    }

    for (const appDef of APP_TOPOLOGY) {
      const rad = (appDef.angle * Math.PI) / 180;
      nodePositionsCache[appDef.name] = {
        x: cx + radiusX * Math.cos(rad),
        y: cy + radiusY * Math.sin(rad),
      };
    }

    // ─── 엣지: Host → App (화살표 포함) ───
    const nodeWidth = 108;
    const nodeHeight = 44;

    for (const appDef of APP_TOPOLOGY) {
      const pos = nodePositionsCache[appDef.name];
      if (!pos) continue;

      // 엣지 끝점을 노드 바운더리에서 멈추도록 조정
      const angle = angleBetween(cx, cy, pos.x, pos.y);
      const endX = pos.x - Math.cos(angle) * (nodeWidth / 2 + 4);
      const endY = pos.y - Math.sin(angle) * (nodeHeight / 2 + 4);
      const startX = cx + Math.cos(angle) * 28; // 호스트 원 바깥
      const startY = cy + Math.sin(angle) * 28;

      const line = svgEl('line', {
        x1: startX, y1: startY,
        x2: endX, y2: endY,
        class: 'topo-edge',
        'marker-end': 'url(#arrow-marker)',
      });
      line.setAttribute('data-from', 'host');
      line.setAttribute('data-to', appDef.name);

      // 트래픽 볼륨에 따른 엣지 굵기
      const trafficKey = `host→${appDef.name}`;
      const traffic = edgeTraffic[trafficKey] ?? 0;
      if (traffic > 0) {
        const thickness = Math.min(1.5 + traffic * 0.3, 4);
        line.style.strokeWidth = `${thickness}`;
        line.style.stroke = '#30363d';
      }

      topoSvg.appendChild(line);
    }

    // ─── 엣지: Parcel 관계 (점선 + 화살표) ───
    for (const edge of PARCEL_EDGES) {
      const fromPos = nodePositionsCache[edge.from];
      const toPos = nodePositionsCache[edge.to];
      if (!fromPos || !toPos) continue;

      const angle = angleBetween(fromPos.x, fromPos.y, toPos.x, toPos.y);
      const startX = fromPos.x + Math.cos(angle) * (nodeWidth / 2 + 2);
      const startY = fromPos.y + Math.sin(angle) * (nodeHeight / 2 + 2);
      const endX = toPos.x - Math.cos(angle) * (nodeWidth / 2 + 4);
      const endY = toPos.y - Math.sin(angle) * (nodeHeight / 2 + 4);

      const line = svgEl('line', {
        x1: startX, y1: startY,
        x2: endX, y2: endY,
        class: 'topo-edge-parcel',
        'marker-end': 'url(#parcel-arrow-marker)',
      });
      topoSvg.appendChild(line);

      // Parcel 라벨 (곡선 경로 위)
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 - 10;
      const parcelPill = svgEl('rect', {
        x: midX - 20, y: midY - 7, width: 40, height: 14,
        rx: 7, ry: 7,
        fill: '#161b22', stroke: '#8b5cf6', 'stroke-width': 0.5,
      });
      topoSvg.appendChild(parcelPill);
      const parcelLabel = svgEl('text', {
        x: midX, y: midY,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: '#8b5cf6', 'font-size': '8', 'font-family': "'SF Mono', monospace",
        'font-weight': '600',
      });
      parcelLabel.textContent = 'Parcel';
      topoSvg.appendChild(parcelLabel);
    }

    // ─── 전환 확률 엣지 (IntelligentPrefetch) ───
    if (prefetch) {
      try {
        const stats = prefetch.getStats();
        for (const stat of stats) {
          const fromPos = nodePositionsCache[stat.from];
          const toPos = nodePositionsCache[stat.to];
          if (!fromPos || !toPos) continue;
          if (stat.ratio < 0.1) continue; // 10% 미만은 표시 안 함

          const angle = angleBetween(fromPos.x, fromPos.y, toPos.x, toPos.y);
          const offsetAngle = angle + Math.PI / 2;
          const offset = 6; // 일반 엣지와 겹치지 않도록 오프셋

          const startX = fromPos.x + Math.cos(angle) * (nodeWidth / 2 + 2) + Math.cos(offsetAngle) * offset;
          const startY = fromPos.y + Math.sin(angle) * (nodeHeight / 2 + 2) + Math.sin(offsetAngle) * offset;
          const endX = toPos.x - Math.cos(angle) * (nodeWidth / 2 + 4) + Math.cos(offsetAngle) * offset;
          const endY = toPos.y - Math.sin(angle) * (nodeHeight / 2 + 4) + Math.sin(offsetAngle) * offset;

          const opacity = 0.3 + stat.ratio * 0.7;
          const line = svgEl('line', {
            x1: startX, y1: startY,
            x2: endX, y2: endY,
            class: 'topo-edge-prefetch',
          });
          line.style.opacity = String(opacity);
          line.style.strokeWidth = String(1 + stat.ratio * 2);
          topoSvg.appendChild(line);

          // 확률 라벨
          const midX = (startX + endX) / 2 + Math.cos(offsetAngle) * 10;
          const midY = (startY + endY) / 2 + Math.sin(offsetAngle) * 10;
          const probLabel = svgEl('text', {
            x: midX, y: midY,
            'text-anchor': 'middle', 'dominant-baseline': 'central',
            fill: '#1f6feb', 'font-size': '7', 'font-family': "'SF Mono', monospace",
            opacity: String(opacity),
          });
          probLabel.textContent = `${Math.round(stat.ratio * 100)}%`;
          topoSvg.appendChild(probLabel);
        }
      } catch {
        // prefetch data가 아직 없으면 무시
      }
    }

    // ─── Host 노드 (중앙) ───
    const hostGroup = svgEl('g');
    const hostCircle = svgEl('circle', { cx, cy, r: 26, class: 'topo-host' });
    hostGroup.appendChild(hostCircle);
    const hostLabel = svgEl('text', { x: cx, y: cy - 3, class: 'topo-host-label' });
    hostLabel.textContent = 'Host';
    hostGroup.appendChild(hostLabel);
    const hostSubLabel = svgEl('text', {
      x: cx, y: cy + 10,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: '#484f58', 'font-size': '7', 'font-family': "'SF Mono', monospace",
    });
    hostSubLabel.textContent = 'esmap';
    hostGroup.appendChild(hostSubLabel);
    topoSvg.appendChild(hostGroup);

    // ─── 앱 노드 ───
    for (const appDef of APP_TOPOLOGY) {
      const pos = nodePositionsCache[appDef.name];
      if (!pos) continue;

      const status = appStatusMap[appDef.name] ?? 'NOT_LOADED';
      const statusColor = STATUS_COLORS[status] ?? '#6b7280';
      const isActive = activeAppRef.value === appDef.name;

      const group = svgEl('g', { class: 'topo-node' });
      group.setAttribute('data-app', appDef.name);

      // 글로우 배경 (이벤트 시 활성화)
      const glowRect = svgEl('rect', {
        x: pos.x - nodeWidth / 2 - 6,
        y: pos.y - nodeHeight / 2 - 6,
        width: nodeWidth + 12,
        height: nodeHeight + 12,
        rx: 14, ry: 14,
        fill: statusColor,
        opacity: 0,
        filter: 'url(#node-glow)',
      });
      glowRect.setAttribute('data-glow', appDef.name);
      group.appendChild(glowRect);

      // 활성 링 (현재 앱)
      const activeRing = svgEl('rect', {
        x: pos.x - nodeWidth / 2 - 4,
        y: pos.y - nodeHeight / 2 - 4,
        width: nodeWidth + 8,
        height: nodeHeight + 8,
        rx: 14, ry: 14,
        class: `topo-active-ring${isActive ? ' visible' : ''}`,
      });
      activeRing.setAttribute('data-active-ring', appDef.name);
      group.appendChild(activeRing);

      // 노드 배경
      const bgRect = svgEl('rect', {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
        fill: '#0d1117',
        stroke: statusColor,
        class: 'topo-node-bg',
      });
      group.appendChild(bgRect);

      // 성능 바 (하단에 얇은 바)
      const perfData = perf.summarize().get(appDef.name);
      if (perfData && perfData.total > 0) {
        const maxMs = 500; // 기준값
        const barWidth = Math.min((perfData.total / maxMs) * (nodeWidth - 4), nodeWidth - 4);
        const barColor = perfData.total < 100 ? '#3fb950' : perfData.total < 300 ? '#d29922' : '#f85149';
        const perfBar = svgEl('rect', {
          x: pos.x - nodeWidth / 2 + 2,
          y: pos.y + nodeHeight / 2 - 4,
          width: barWidth,
          height: 2,
          rx: 1, ry: 1,
          fill: barColor,
          opacity: 0.8,
          class: 'topo-perf-bar',
        });
        group.appendChild(perfBar);

        // 성능 수치 (노드 우측 하단)
        const perfLabel = svgEl('text', {
          x: pos.x + nodeWidth / 2 - 4,
          y: pos.y + nodeHeight / 2 - 6,
          'text-anchor': 'end', 'dominant-baseline': 'auto',
          fill: barColor, 'font-size': '7', 'font-family': "'SF Mono', monospace",
          opacity: 0.7,
        });
        perfLabel.textContent = `${Math.round(perfData.total)}ms`;
        group.appendChild(perfLabel);
      }

      // 상태 도트
      const dot = svgEl('circle', {
        cx: pos.x - nodeWidth / 2 + 14,
        cy: pos.y - 3,
        r: 4,
        fill: statusColor,
        class: 'topo-status-dot',
      });
      group.appendChild(dot);

      // 앱 이름
      const label = svgEl('text', {
        x: pos.x + 4,
        y: pos.y - 5,
        class: 'topo-label',
      });
      label.textContent = appDef.short;
      group.appendChild(label);

      // 상태 텍스트
      const statusLabel = svgEl('text', {
        x: pos.x + 4,
        y: pos.y + 9,
        class: 'topo-sublabel',
      });
      statusLabel.textContent = status.toLowerCase();
      group.appendChild(statusLabel);

      // keepAlive 아이콘 (frozen 상태일 때 ❄ 표시)
      if (status === 'FROZEN') {
        const frozenIcon = svgEl('text', {
          x: pos.x + nodeWidth / 2 - 10,
          y: pos.y - nodeHeight / 2 + 12,
          'font-size': '10',
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
        });
        frozenIcon.textContent = '❄';
        group.appendChild(frozenIcon);
      }

      // 호버 이벤트 → 리치 툴팁
      group.addEventListener('mouseenter', (e) => {
        const pData = perf.summarize().get(appDef.name);
        const perfRows = pData
          ? Object.entries(pData.phases).map(([phase, duration]) =>
              `<div class="topo-tooltip-row"><span class="topo-tooltip-label">${phase}</span><span class="topo-tooltip-value">${duration.toFixed(0)}ms</span></div>`
            ).join('') +
            `<div class="topo-tooltip-row"><span class="topo-tooltip-label">Total</span><span class="topo-tooltip-value" style="font-weight:600">${pData.total.toFixed(0)}ms</span></div>`
          : '<div style="color:#484f58">No perf data yet</div>';

        const prefetchRows = prefetch ? (() => {
          try {
            const priorities = prefetch.getPriorities(appDef.name);
            if (priorities.length === 0) return '';
            const items = priorities.slice(0, 3).map((p) =>
              `<span style="color:#1f6feb">${shortName(p.appName)}</span> ${Math.round(p.probability * 100)}%`
            ).join(', ');
            return `<div class="topo-tooltip-row" style="margin-top:4px"><span class="topo-tooltip-label">Prefetch →</span><span class="topo-tooltip-value">${items}</span></div>`;
          } catch { return ''; }
        })() : '';

        const inboundKey = `host→${appDef.name}`;
        const outboundKey = `${appDef.name}→host`;
        const inboundCount = edgeTraffic[inboundKey] ?? 0;
        const outboundCount = edgeTraffic[outboundKey] ?? 0;

        topoTooltip.innerHTML = `
          <div class="topo-tooltip-title">${appDef.name}</div>
          <div class="topo-tooltip-row"><span class="topo-tooltip-label">Status</span><span class="topo-tooltip-value" style="color:${statusColor}">${status}</span></div>
          <div class="topo-tooltip-row"><span class="topo-tooltip-label">Container</span><span class="topo-tooltip-value">${appDef.container}</span></div>
          <div class="topo-tooltip-row"><span class="topo-tooltip-label">Host → App</span><span class="topo-tooltip-value">${inboundCount} events</span></div>
          <div class="topo-tooltip-row"><span class="topo-tooltip-label">App → Host</span><span class="topo-tooltip-value">${outboundCount} events</span></div>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid #21262d">${perfRows}</div>
          ${prefetchRows}
        `;
        topoTooltip.style.display = 'block';
        const panelRect = topoContainer.getBoundingClientRect();
        topoTooltip.style.left = `${e.clientX - panelRect.left + 14}px`;
        topoTooltip.style.top = `${e.clientY - panelRect.top - 20}px`;

        // 엣지 하이라이트
        topoSvg.querySelectorAll<SVGLineElement>('.topo-edge').forEach((edge) => {
          const isConnected = edge.getAttribute('data-to') === appDef.name;
          edge.style.stroke = isConnected ? statusColor : '#21262d';
          edge.style.strokeWidth = isConnected ? '2.5' : '1.5';
        });
      });
      group.addEventListener('mouseleave', () => {
        topoTooltip.style.display = 'none';
        topoSvg.querySelectorAll<SVGLineElement>('.topo-edge').forEach((edge) => {
          edge.style.stroke = '';
          edge.style.strokeWidth = '';
        });
      });
      group.addEventListener('mousemove', (e) => {
        const panelRect = topoContainer.getBoundingClientRect();
        topoTooltip.style.left = `${e.clientX - panelRect.left + 14}px`;
        topoTooltip.style.top = `${e.clientY - panelRect.top - 20}px`;
      });

      topoSvg.appendChild(group);
    }
  }

  /** 노드에 글로우 효과를 일시적으로 적용한다 */
  function pulseNode(appName: string, color: string): void {
    const glow = topoSvg.querySelector<SVGRectElement>(`[data-glow="${appName}"]`);
    if (!glow) return;
    glow.setAttribute('fill', color);
    glow.setAttribute('opacity', '0.6');

    // 기존 타이머 제거
    if (glowTimers[appName]) clearTimeout(glowTimers[appName]);

    glowTimers[appName] = setTimeout(() => {
      glow.setAttribute('opacity', '0');
    }, 600);
  }

  /** 이벤트 발생 시 토폴로지 엣지에 애니메이션 파티클을 표시한다 */
  function animateParticle(fromApp: string, toApp: string, color: string): void {
    if (topologyPanel.style.display === 'none') return;

    const fromPos = fromApp === 'host'
      ? { x: centerCache.x, y: centerCache.y }
      : nodePositionsCache[fromApp];
    const toPos = toApp === 'host'
      ? { x: centerCache.x, y: centerCache.y }
      : nodePositionsCache[toApp];

    if (!fromPos || !toPos) return;

    // SVG animated circle along path
    const particle = svgEl('circle', { r: 3, fill: color, opacity: 0.9 });

    const animX = svgEl('animate', {
      attributeName: 'cx',
      from: fromPos.x,
      to: toPos.x,
      dur: '0.5s',
      fill: 'freeze',
    });
    const animY = svgEl('animate', {
      attributeName: 'cy',
      from: fromPos.y,
      to: toPos.y,
      dur: '0.5s',
      fill: 'freeze',
    });
    const animOpacity = svgEl('animate', {
      attributeName: 'opacity',
      from: '0.9',
      to: '0',
      dur: '0.5s',
      begin: '0.3s',
      fill: 'freeze',
    });

    particle.appendChild(animX);
    particle.appendChild(animY);
    particle.appendChild(animOpacity);
    topoSvg.appendChild(particle);

    setTimeout(() => particle.remove(), 800);
  }

  // 초기 렌더
  setTimeout(() => refreshTopology(), 80);

  // ═══════════════════════════════════════════════
  // ─── FLOW PANEL (시퀀스 다이어그램) ───
  // ═══════════════════════════════════════════════

  const flowContainer = document.createElement('div');
  flowContainer.className = 'flow-container';
  flowPanel.appendChild(flowContainer);

  const flowHeader = document.createElement('div');
  flowHeader.className = 'flow-header';
  flowHeader.innerHTML = `
    <span class="flow-header-label">Inter-App Communication Flow</span>
    <span class="flow-stats" data-flow-stats>0 flows tracked</span>
  `;
  flowContainer.appendChild(flowHeader);

  const flowCanvas = document.createElement('div');
  flowCanvas.className = 'flow-canvas';
  flowContainer.appendChild(flowCanvas);

  const flowSwimlanes = document.createElement('div');
  flowSwimlanes.className = 'flow-swimlanes';
  flowSwimlanes.style.position = 'relative';
  flowCanvas.appendChild(flowSwimlanes);

  const flowArrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  flowArrowSvg.classList.add('flow-arrow-overlay');
  flowSwimlanes.appendChild(flowArrowSvg);

  // 스윔레인 생성 (Host + 각 앱)
  const allLanes = ['Host', ...APP_TOPOLOGY.map((a) => a.short)];
  const laneElements: Record<string, HTMLElement> = {};

  for (const laneName of allLanes) {
    const lane = document.createElement('div');
    lane.className = 'flow-lane';

    const label = document.createElement('div');
    label.className = 'flow-lane-label';
    label.textContent = laneName;
    lane.appendChild(label);

    const content = document.createElement('div');
    content.className = 'flow-lane-content';
    lane.appendChild(content);

    flowSwimlanes.appendChild(lane);
    laneElements[laneName] = content;
  }

  /** 앱 이름을 레인 이름으로 매핑한다 */
  function toLaneName(appName: string): string {
    if (appName === 'host') return 'Host';
    const found = APP_TOPOLOGY.find((a) => a.name === appName);
    return found ? found.short : shortName(appName);
  }

  /** Flow 뷰를 새로 그린다 */
  function refreshFlowView(): void {
    // 레인 콘텐츠 초기화
    for (const content of Object.values(laneElements)) {
      content.innerHTML = '';
    }
    flowArrowSvg.innerHTML = '';

    const statsEl = flowHeader.querySelector('[data-flow-stats]');
    if (statsEl) statsEl.textContent = `${flows.length} flows tracked`;

    if (flows.length === 0) return;

    const startTime = flows[0].timestamp;
    const timeRange = Math.max(flows[flows.length - 1].timestamp - startTime, 3000);
    const pixelsPerMs = Math.max(0.08, Math.min(0.3, (flowCanvas.clientWidth - 200) / timeRange));
    const totalWidth = Math.max(timeRange * pixelsPerMs + 200, flowCanvas.clientWidth);

    flowSwimlanes.style.width = `${totalWidth}px`;

    // 레인 인덱스 → 세로 중심 좌표 매핑
    const laneIndexMap: Record<string, number> = {};
    for (const [i, name] of allLanes.entries()) {
      laneIndexMap[name] = i;
    }
    const laneHeight = 36; // min-height of .flow-lane
    const svgH = allLanes.length * laneHeight;
    flowArrowSvg.setAttribute('width', `${totalWidth}`);
    flowArrowSvg.setAttribute('height', `${svgH}`);
    flowArrowSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${svgH}`);

    // Arrow marker defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
      if (cat === 'all') continue;
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `flow-arrow-${cat}`);
      marker.setAttribute('markerWidth', '5');
      marker.setAttribute('markerHeight', '4');
      marker.setAttribute('refX', '4');
      marker.setAttribute('refY', '2');
      marker.setAttribute('orient', 'auto');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M0,0 L5,2 L0,4 Z');
      path.setAttribute('fill', color);
      path.setAttribute('opacity', '0.4');
      marker.appendChild(path);
      defs.appendChild(marker);
    }
    flowArrowSvg.appendChild(defs);

    for (const flow of flows) {
      const x = (flow.timestamp - startTime) * pixelsPerMs + 20;
      const fromLane = toLaneName(flow.from);
      const toLane = toLaneName(flow.to);

      // 소스 레인에 이벤트 도트
      const fromContent = laneElements[fromLane];
      if (fromContent) {
        const dot = document.createElement('div');
        dot.className = 'flow-event-dot';
        dot.style.left = `${x}px`;
        dot.style.background = CATEGORY_COLORS[flow.category];
        dot.title = `${formatTime(flow.timestamp)} ${flow.event}\n${flow.from} → ${flow.to}`;
        fromContent.appendChild(dot);
      }

      // 대상 레인에도 수신 도트
      const toContent = laneElements[toLane];
      if (toContent && fromLane !== toLane) {
        const receiveDot = document.createElement('div');
        receiveDot.className = 'flow-event-dot';
        receiveDot.style.left = `${x + 2}px`;
        receiveDot.style.background = CATEGORY_COLORS[flow.category];
        receiveDot.style.opacity = '0.5';
        receiveDot.style.width = '6px';
        receiveDot.style.height = '6px';
        receiveDot.title = `${formatTime(flow.timestamp)} ← ${flow.event}`;
        toContent.appendChild(receiveDot);

        // 레인 간 연결 화살표 (SVG)
        const fromIdx = laneIndexMap[fromLane];
        const toIdx = laneIndexMap[toLane];
        if (fromIdx !== undefined && toIdx !== undefined) {
          const y1 = fromIdx * laneHeight + laneHeight / 2;
          const y2 = toIdx * laneHeight + laneHeight / 2;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(x + 84)); // offset for label width
          line.setAttribute('y1', String(y1));
          line.setAttribute('x2', String(x + 86));
          line.setAttribute('y2', String(y2));
          line.setAttribute('stroke', CATEGORY_COLORS[flow.category]);
          line.setAttribute('stroke-width', '1');
          line.setAttribute('opacity', '0.25');
          line.setAttribute('marker-end', `url(#flow-arrow-${flow.category})`);
          flowArrowSvg.appendChild(line);
        }
      }
    }

    // 최신 이벤트로 스크롤
    flowCanvas.scrollLeft = flowCanvas.scrollWidth;
  }

  /** 앱 간 플로우를 기록한다 */
  function addFlow(entry: FlowEntry): void {
    flows.push(entry);
    if (flows.length > MAX_FLOWS) flows.shift();

    if (flowPanel.style.display !== 'none') {
      refreshFlowView();
    }
  }

  // ═══════════════════════════════════════════════
  // ─── EVENTS PANEL ───
  // ═══════════════════════════════════════════════

  const eventsContainer = document.createElement('div');
  eventsContainer.className = 'events-container';
  eventsPanel.appendChild(eventsContainer);

  const eventsToolbar = document.createElement('div');
  eventsToolbar.className = 'events-toolbar';
  eventsContainer.appendChild(eventsToolbar);

  const categories: EventCategory[] = ['all', 'lifecycle', 'auth', 'route', 'state', 'error'];
  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.className = `events-filter-btn${cat === 'all' ? ' active' : ''}`;
    btn.textContent = CATEGORY_LABELS[cat];
    btn.style.color = CATEGORY_COLORS[cat];
    btn.addEventListener('click', () => {
      eventsToolbar.querySelectorAll('.events-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter.value = cat;
      renderFilteredEvents();
    });
    eventsToolbar.appendChild(btn);
  }

  // Clear 버튼
  const clearBtn = document.createElement('button');
  clearBtn.className = 'events-clear-btn';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    events.length = 0;
    logCountRef.value = 0;
    logCountEl.textContent = '0 events';
    eventsList.innerHTML = '';
  });
  eventsToolbar.appendChild(clearBtn);

  const eventsList = document.createElement('div');
  eventsList.className = 'events-list';
  eventsContainer.appendChild(eventsList);

  /** 필터에 맞는 이벤트만 렌더링한다 */
  function renderFilteredEvents(): void {
    eventsList.innerHTML = '';
    const filtered = activeFilter.value === 'all'
      ? events
      : events.filter((e) => e.category === activeFilter.value);

    for (const entry of filtered) {
      eventsList.appendChild(createEventElement(entry));
    }
    eventsList.scrollTop = eventsList.scrollHeight;
  }

  /** 이벤트 항목 DOM 요소를 생성한다 */
  function createEventElement(entry: EventEntry): HTMLElement {
    const row = document.createElement('div');
    row.className = 'event-entry';

    const time = document.createElement('span');
    time.className = 'event-time';
    time.textContent = formatTime(entry.timestamp);

    const badge = document.createElement('span');
    badge.className = 'event-badge';
    badge.textContent = CATEGORY_LABELS[entry.category];
    badge.style.background = `${CATEGORY_COLORS[entry.category]}15`;
    badge.style.color = CATEGORY_COLORS[entry.category];

    const name = document.createElement('span');
    name.className = 'event-name';
    name.textContent = entry.name;

    const detail = document.createElement('span');
    detail.className = 'event-detail';
    detail.textContent = entry.detail;

    row.appendChild(time);
    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(detail);
    return row;
  }

  /** 이벤트를 추가하고 UI를 업데이트한다 */
  function addEvent(entry: EventEntry): void {
    events.push(entry);
    if (events.length > MAX_EVENTS) events.shift();

    logCountRef.value += 1;
    logCountEl.textContent = `${logCountRef.value} events`;

    if (activeFilter.value === 'all' || activeFilter.value === entry.category) {
      const shouldScroll = eventsList.scrollHeight - eventsList.scrollTop - eventsList.clientHeight < 40;
      eventsList.appendChild(createEventElement(entry));

      while (eventsList.children.length > MAX_EVENTS) {
        eventsList.removeChild(eventsList.firstChild as Node);
      }

      if (shouldScroll) {
        eventsList.scrollTop = eventsList.scrollHeight;
      }
    }
  }

  // ═══════════════════════════════════════════════
  // ─── STATE PANEL ───
  // ═══════════════════════════════════════════════

  const stateContainer = document.createElement('div');
  stateContainer.className = 'state-container';
  statePanel.appendChild(stateContainer);

  const stateCurrent = document.createElement('div');
  stateCurrent.className = 'state-current';
  stateContainer.appendChild(stateCurrent);

  const stateHistoryDiv = document.createElement('div');
  stateHistoryDiv.className = 'state-history';
  stateContainer.appendChild(stateHistoryDiv);

  /** 현재 상태 트리 뷰를 새로 그린다 */
  function refreshStateView(): void {
    const state = globalState.getState();
    stateCurrent.innerHTML = `
      <div class="state-section-title">Current State</div>
      <pre class="state-tree">${renderJsonTree(state, 0)}</pre>
    `;
    renderStateHistory();
  }

  /** 상태 변경 이력을 렌더링한다 */
  function renderStateHistory(): void {
    stateHistoryDiv.innerHTML = `<div class="state-section-title">Change History (${stateHistory.length})</div>`;

    const reversed = [...stateHistory].reverse();
    for (const entry of reversed) {
      const entryDiv = document.createElement('div');
      entryDiv.className = 'state-diff-entry';

      const timeDiv = document.createElement('div');
      timeDiv.className = 'state-diff-time';
      timeDiv.textContent = formatTime(entry.timestamp);
      entryDiv.appendChild(timeDiv);

      for (const diff of entry.diff) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'state-diff-item';
        itemDiv.innerHTML = `
          <span class="state-diff-key">${escapeHtml(diff.key)}</span>:
          <span class="state-diff-old">${escapeHtml(JSON.stringify(diff.oldValue))}</span>
          <span class="state-diff-arrow">&rarr;</span>
          <span class="state-diff-new">${escapeHtml(JSON.stringify(diff.newValue))}</span>
        `;
        entryDiv.appendChild(itemDiv);
      }
      stateHistoryDiv.appendChild(entryDiv);
    }
  }

  // ═══════════════════════════════════════════════
  // ─── Wire up data sources ───
  // ═══════════════════════════════════════════════

  /** 상태 전이를 라이프사이클 phase 이름으로 매핑한다 */
  function resolvePhaseFromTransition(from: string, to: string): { endPhase: string; startPhase: string } | null {
    const upper = (s: string): string => s.toUpperCase();
    const f = upper(from);
    const t = upper(to);

    if (f === 'NOT_LOADED' && t === 'LOADING') return { endPhase: '', startPhase: 'load' };
    if (f === 'LOADING' && t === 'BOOTSTRAPPING') return { endPhase: 'load', startPhase: 'bootstrap' };
    if (f === 'BOOTSTRAPPING' && t === 'NOT_MOUNTED') return { endPhase: 'bootstrap', startPhase: 'mount' };
    if (f === 'NOT_MOUNTED' && t === 'MOUNTED') return { endPhase: 'mount', startPhase: '' };
    if ((f === 'MOUNTED' || f === 'NOT_MOUNTED') && t === 'UNMOUNTING') return { endPhase: '', startPhase: 'unmount' };
    if (f === 'UNMOUNTING' && t === 'NOT_MOUNTED') return { endPhase: 'unmount', startPhase: '' };
    return null;
  }

  // 레지스트리 상태 변경 → 토폴로지 + 이벤트 + 플로우 + 파생 성능 데이터
  registry.onStatusChange((event) => {
    statusCache[event.appName] = event.to;

    const trafficKey = `host→${event.appName}`;
    edgeTraffic[trafficKey] = (edgeTraffic[trafficKey] ?? 0) + 1;

    addEvent({
      timestamp: Date.now(),
      category: 'lifecycle',
      name: `${shortName(event.appName)}`,
      detail: `${event.from} → ${event.to}`,
      appName: event.appName,
    });

    // 라이프사이클 전이에서 성능 데이터 파생
    const now = performance.now();
    const phaseInfo = resolvePhaseFromTransition(event.from, event.to);
    if (phaseInfo) {
      if (!phaseStartTimes[event.appName]) {
        phaseStartTimes[event.appName] = {};
      }
      if (!derivedPerfData[event.appName]) {
        derivedPerfData[event.appName] = { total: 0, phases: {} };
      }

      // 종료되는 phase의 duration 계산
      if (phaseInfo.endPhase && phaseStartTimes[event.appName][phaseInfo.endPhase]) {
        const duration = now - phaseStartTimes[event.appName][phaseInfo.endPhase];
        derivedPerfData[event.appName].phases[phaseInfo.endPhase] = duration;
        derivedPerfData[event.appName].total = Object.values(derivedPerfData[event.appName].phases)
          .reduce((sum, d) => sum + d, 0);
        delete phaseStartTimes[event.appName][phaseInfo.endPhase];
      }

      // 새로 시작되는 phase 기록
      if (phaseInfo.startPhase) {
        phaseStartTimes[event.appName][phaseInfo.startPhase] = now;
      }

      // Perf 탭이 보이면 업데이트
      if (perfPanel.style.display !== 'none') {
        refreshPerfView();
      }
    }

    // 토폴로지 시각 효과
    pulseNode(event.appName, CATEGORY_COLORS.lifecycle);
    animateParticle('host', event.appName, CATEGORY_COLORS.lifecycle);

    // 플로우 기록
    addFlow({
      timestamp: Date.now(),
      from: 'host',
      to: event.appName,
      event: `${event.from} → ${event.to}`,
      category: 'lifecycle',
    });

    refreshTopology();
  });

  // 이벤트 버스 구독
  try {
    eventBus.on('auth:login', (payload) => {
      addEvent({
        timestamp: Date.now(),
        category: 'auth',
        name: 'auth:login',
        detail: JSON.stringify(payload),
        appName: '@enterprise/auth',
      });
      pulseNode('@enterprise/auth', CATEGORY_COLORS.auth);
      animateParticle('@enterprise/auth', 'host', CATEGORY_COLORS.auth);
      const authLoginKey = `@enterprise/auth→host`;
      edgeTraffic[authLoginKey] = (edgeTraffic[authLoginKey] ?? 0) + 1;
      addFlow({
        timestamp: Date.now(),
        from: '@enterprise/auth',
        to: 'host',
        event: 'auth:login',
        category: 'auth',
      });
    });
    eventBus.on('auth:logout', () => {
      addEvent({
        timestamp: Date.now(),
        category: 'auth',
        name: 'auth:logout',
        detail: '',
        appName: '@enterprise/auth',
      });
      pulseNode('@enterprise/auth', CATEGORY_COLORS.auth);
      animateParticle('@enterprise/auth', 'host', CATEGORY_COLORS.auth);
      const authLogoutKey = `@enterprise/auth→host`;
      edgeTraffic[authLogoutKey] = (edgeTraffic[authLogoutKey] ?? 0) + 1;
      addFlow({
        timestamp: Date.now(),
        from: '@enterprise/auth',
        to: 'host',
        event: 'auth:logout',
        category: 'auth',
      });
    });
    eventBus.on('activity:new', (payload) => {
      addEvent({
        timestamp: Date.now(),
        category: 'lifecycle',
        name: 'activity:new',
        detail: JSON.stringify(payload),
        appName: '@enterprise/activity-feed',
      });
      pulseNode('@enterprise/activity-feed', CATEGORY_COLORS.lifecycle);
      animateParticle('@enterprise/activity-feed', 'host', CATEGORY_COLORS.lifecycle);
      const activityKey = `@enterprise/activity-feed→host`;
      edgeTraffic[activityKey] = (edgeTraffic[activityKey] ?? 0) + 1;
      addFlow({
        timestamp: Date.now(),
        from: '@enterprise/activity-feed',
        to: 'host',
        event: 'activity:new',
        category: 'lifecycle',
      });
    });
    eventBus.on('lifecycle', (payload) => {
      addEvent({
        timestamp: Date.now(),
        category: 'lifecycle',
        name: 'lifecycle',
        detail: JSON.stringify(payload),
      });
    });
  } catch {
    // eventBus API가 on('*')을 지원하지 않으면 무시한다
  }

  // 글로벌 상태 구독
  globalState.subscribe((newState, prevState) => {
    const diffs: Array<{ key: string; oldValue: unknown; newValue: unknown }> = [];
    const allKeys = new Set([...Object.keys(newState), ...Object.keys(prevState)]);
    for (const key of allKeys) {
      if (JSON.stringify(newState[key]) !== JSON.stringify(prevState[key])) {
        diffs.push({ key, oldValue: prevState[key], newValue: newState[key] });
      }
    }
    if (diffs.length > 0) {
      stateHistory.push({ timestamp: Date.now(), diff: diffs });
      if (stateHistory.length > MAX_STATE_HISTORY) stateHistory.shift();

      addEvent({
        timestamp: Date.now(),
        category: 'state',
        name: 'state:change',
        detail: diffs.map((d) => `${d.key}: ${JSON.stringify(d.oldValue)} → ${JSON.stringify(d.newValue)}`).join(', '),
      });

      if (statePanel.classList.contains('active')) {
        refreshStateView();
      }
    }
    const currentApp = newState['currentApp'];
    if (typeof currentApp === 'string') {
      activeAppRef.value = currentApp;
    }
  });

  // 라우터 이벤트 → Flow에도 기록
  router.afterRouteChange((_from, to) => {
    const now = Date.now();
    addEvent({
      timestamp: now,
      category: 'route',
      name: 'route:change',
      detail: `${_from.pathname} → ${to.pathname}`,
    });

    // 라우트 변경을 Host → 대상 앱으로 플로우에 기록
    const targetApp = APP_TOPOLOGY.find((a) => {
      const path = a.name === '@enterprise/dashboard' ? '/dashboard' : `/${a.short.toLowerCase()}`;
      return to.pathname === path || (to.pathname === '/' && a.name === '@enterprise/dashboard');
    });
    if (targetApp) {
      addFlow({
        timestamp: now,
        from: 'host',
        to: targetApp.name,
        event: `route → ${to.pathname}`,
        category: 'route',
      });
    }
  });

  // 기존 이벤트 히스토리 로드
  try {
    const history = eventBus.getHistory();
    for (const item of history) {
      addEvent({
        timestamp: item.timestamp,
        category: classifyMessage(String(item.event)),
        name: String(item.event),
        detail: JSON.stringify(item.payload),
      });
    }
  } catch {
    // getHistory가 지원되지 않으면 무시한다
  }

  // 초기 상태 렌더
  refreshStateView();

  // ─── Perf measurement listener (실시간 성능 데이터) ───
  if (perf.onMeasurement) {
    try {
      perf.onMeasurement((measurement) => {
        addEvent({
          timestamp: Date.now(),
          category: 'lifecycle',
          name: `perf:${measurement.phase}`,
          detail: `${shortName(measurement.appName)} ${measurement.duration.toFixed(0)}ms`,
          appName: measurement.appName,
        });
        // 토폴로지가 보이면 성능 바 업데이트를 위해 리프레시
        if (topologyPanel.style.display !== 'none') {
          refreshTopology();
        }
        // Perf 탭이 보이면 워터폴 업데이트
        if (perfPanel.style.display !== 'none') {
          refreshPerfView();
        }
      });
    } catch {
      // onMeasurement이 지원되지 않으면 무시
    }
  }

  // ═══════════════════════════════════════════════
  // ─── PERF WATERFALL PANEL ───
  // ═══════════════════════════════════════════════

  /** 성능 위상(phase)별 색상 */
  const PHASE_COLORS: Record<string, string> = {
    load: '#60a5fa',
    bootstrap: '#c084fc',
    mount: '#4ade80',
    unmount: '#fb923c',
    update: '#fbbf24',
  };

  /** perf.summarize()와 derivedPerfData를 병합한 성능 데이터를 구성한다 */
  function collectPerfSummary(): Map<string, { total: number; phases: Record<string, number> }> {
    const summary = perf.summarize();
    const merged = new Map<string, { total: number; phases: Record<string, number> }>(summary);

    // perf.summarize()에 없는 앱은 derivedPerfData에서 채운다
    for (const [appName, data] of Object.entries(derivedPerfData)) {
      if (!merged.has(appName) && data.total > 0) {
        merged.set(appName, { total: data.total, phases: { ...data.phases } });
      }
    }
    return merged;
  }

  /** 성능 워터폴 뷰를 렌더링한다 */
  function refreshPerfView(): void {
    const summary = collectPerfSummary();

    perfPanel.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'perf-container';
    perfPanel.appendChild(container);

    const title = document.createElement('div');
    title.className = 'perf-title';
    title.textContent = 'App Load Performance Waterfall';
    container.appendChild(title);

    if (summary.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'perf-empty';
      empty.textContent = 'No performance data yet. Navigate between pages to collect measurements.';
      container.appendChild(empty);
      return;
    }

    // 전체 최대 시간 계산 (스케일링 기준)
    const maxTotal = Math.max(...Array.from(summary.values()).map((d) => d.total), 1);

    // 스케일 눈금 표시
    const scale = document.createElement('div');
    scale.className = 'perf-scale';
    const ticks = [0, Math.round(maxTotal * 0.25), Math.round(maxTotal * 0.5), Math.round(maxTotal * 0.75), Math.round(maxTotal)];
    for (const tick of ticks) {
      const marker = document.createElement('span');
      marker.className = 'perf-scale-marker';
      marker.textContent = `${tick}ms`;
      scale.appendChild(marker);
    }
    container.appendChild(scale);

    // 앱별 워터폴 행
    for (const appDef of APP_TOPOLOGY) {
      const data = summary.get(appDef.name);
      if (!data || data.total === 0) continue;

      const row = document.createElement('div');
      row.className = 'perf-row';

      const nameEl = document.createElement('div');
      nameEl.className = 'perf-app-name';
      nameEl.textContent = appDef.short;
      row.appendChild(nameEl);

      const barContainer = document.createElement('div');
      barContainer.className = 'perf-bar-container';

      // 위상별 세그먼트 (stacked bar)
      const entries = Object.entries(data.phases);
      for (const [phase, duration] of entries) {
        const widthPct = (duration / maxTotal) * 100;
        if (widthPct < 0.5) continue;

        const segment = document.createElement('div');
        segment.className = 'perf-bar-segment';
        segment.style.width = `${widthPct}%`;
        segment.style.background = PHASE_COLORS[phase] ?? '#6b7280';
        segment.title = `${phase}: ${duration.toFixed(1)}ms`;

        if (widthPct > 8) {
          segment.textContent = `${phase} ${Math.round(duration)}ms`;
        }
        barContainer.appendChild(segment);
      }

      row.appendChild(barContainer);

      const totalEl = document.createElement('div');
      totalEl.className = 'perf-total';
      totalEl.style.color = data.total < 100 ? '#4ade80' : data.total < 300 ? '#fbbf24' : '#f87171';
      totalEl.textContent = `${Math.round(data.total)}ms`;
      row.appendChild(totalEl);

      container.appendChild(row);
    }

    // 범례
    const legend = document.createElement('div');
    legend.className = 'perf-legend';
    for (const [phase, color] of Object.entries(PHASE_COLORS)) {
      const item = document.createElement('div');
      item.className = 'perf-legend-item';
      const dot = document.createElement('div');
      dot.className = 'perf-legend-dot';
      dot.style.background = color;
      item.appendChild(dot);
      const label = document.createElement('span');
      label.textContent = phase;
      item.appendChild(label);
      legend.appendChild(item);
    }
    container.appendChild(legend);
  }

  // ═══════════════════════════════════════════════
  // ─── DEPS (SHARED MODULE DEPENDENCY) PANEL ───
  // ═══════════════════════════════════════════════

  /** 공유 모듈 의존성 뷰를 렌더링한다 */
  function refreshDepsView(): void {
    depsPanel.innerHTML = '';

    if (!sharedModules) {
      const empty = document.createElement('div');
      empty.className = 'perf-empty';
      empty.textContent = 'Shared module registry not available.';
      depsPanel.appendChild(empty);
      return;
    }

    const container = document.createElement('div');
    container.style.cssText = 'padding:16px;font-family:"SF Mono","JetBrains Mono",monospace;font-size:12px;overflow-y:auto;height:100%';
    depsPanel.appendChild(container);

    const title = document.createElement('div');
    title.style.cssText = 'font-size:14px;font-weight:700;color:#e6edf3;margin-bottom:16px';
    title.textContent = 'Shared Module Dependencies';
    container.appendChild(title);

    const registered = sharedModules.getRegistered();
    const loaded = sharedModules.getLoaded();

    if (registered.size === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#6b7280;padding:24px 0;text-align:center';
      empty.textContent = 'No shared modules registered yet.';
      container.appendChild(empty);
      return;
    }

    // ─── 요약 배너: 버전 충돌 감지 ───
    const conflictModules: string[] = [];
    for (const [modName, candidates] of registered) {
      const versions = new Set(candidates.map((c) => c.version));
      if (versions.size > 1) conflictModules.push(modName);
    }

    if (conflictModules.length > 0) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#f8717120;border:1px solid #f8717140;border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:8px';
      banner.innerHTML = `<span style="font-size:16px">⚠</span><span style="color:#f87171;font-weight:600">Version conflicts detected in ${conflictModules.length} module(s):</span> <span style="color:#e6edf3">${conflictModules.join(', ')}</span>`;
      container.appendChild(banner);
    } else {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#3fb95015;border:1px solid #3fb95030;border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:8px';
      banner.innerHTML = `<span style="font-size:16px">✓</span><span style="color:#3fb950;font-weight:600">${registered.size} shared modules — all versions aligned</span>`;
      container.appendChild(banner);
    }

    // ─── 모듈 카드 리스트 ───
    for (const [moduleName, candidates] of registered) {
      const loadedInfo = loaded.get(moduleName);
      const uniqueVersions = new Set(candidates.map((c) => c.version));
      const hasConflict = uniqueVersions.size > 1;

      const card = document.createElement('div');
      card.style.cssText = `background:#161b22;border:1px solid ${hasConflict ? '#f8717140' : '#21262d'};border-radius:8px;padding:12px 16px;margin-bottom:10px`;

      // 헤더: 모듈 이름 + 로딩 상태 배지
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';

      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-weight:600;color:#e6edf3;font-size:13px';
      nameEl.textContent = moduleName;
      header.appendChild(nameEl);

      const badge = document.createElement('span');
      badge.style.cssText = `font-size:10px;padding:1px 8px;border-radius:10px;font-weight:500;${
        loadedInfo
          ? 'background:#3fb95020;color:#3fb950;border:1px solid #3fb95040'
          : 'background:#6b728020;color:#6b7280;border:1px solid #6b728040'
      }`;
      badge.textContent = loadedInfo ? `v${loadedInfo.version} loaded` : 'not loaded';
      header.appendChild(badge);

      // Singleton 배지
      const isSingleton = candidates.some((c) => c.singleton);
      if (isSingleton) {
        const singletonBadge = document.createElement('span');
        singletonBadge.style.cssText = 'font-size:10px;padding:1px 8px;border-radius:10px;background:#c084fc20;color:#c084fc;border:1px solid #c084fc40;font-weight:500';
        singletonBadge.textContent = 'singleton';
        header.appendChild(singletonBadge);
      }

      // Eager 배지
      const isEager = candidates.some((c) => c.eager);
      if (isEager) {
        const eagerBadge = document.createElement('span');
        eagerBadge.style.cssText = 'font-size:10px;padding:1px 8px;border-radius:10px;background:#60a5fa20;color:#60a5fa;border:1px solid #60a5fa40;font-weight:500';
        eagerBadge.textContent = 'eager';
        header.appendChild(eagerBadge);
      }

      // Version conflict 배지
      if (hasConflict) {
        const conflictBadge = document.createElement('span');
        conflictBadge.style.cssText = 'font-size:10px;padding:1px 8px;border-radius:10px;background:#f8717120;color:#f87171;border:1px solid #f8717140;font-weight:500';
        conflictBadge.textContent = `${uniqueVersions.size} versions`;
        header.appendChild(conflictBadge);
      }

      card.appendChild(header);

      // Provider 목록 (어떤 앱이 이 모듈을 등록했는지)
      const providerList = document.createElement('div');
      providerList.style.cssText = 'display:flex;flex-direction:column;gap:4px';

      for (const candidate of candidates) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px';

        // 선택된 버전 표시 (loaded와 일치하면 하이라이트)
        const isActive = loadedInfo?.version === candidate.version && loadedInfo.from === candidate.from;
        const indicator = document.createElement('span');
        indicator.style.cssText = `width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${isActive ? '#4ade80' : '#30363d'}`;
        row.appendChild(indicator);

        const fromEl = document.createElement('span');
        fromEl.style.cssText = 'color:#7d8590;min-width:100px';
        fromEl.textContent = candidate.from ? shortName(candidate.from) : 'host';
        row.appendChild(fromEl);

        const verEl = document.createElement('span');
        verEl.style.cssText = `color:${isActive ? '#e6edf3' : '#484f58'}`;
        verEl.textContent = `v${candidate.version}`;
        row.appendChild(verEl);

        if (candidate.requiredVersion) {
          const reqEl = document.createElement('span');
          reqEl.style.cssText = 'color:#484f58;font-size:10px';
          reqEl.textContent = `(requires ${candidate.requiredVersion})`;
          row.appendChild(reqEl);
        }

        providerList.appendChild(row);
      }

      card.appendChild(providerList);
      container.appendChild(card);
    }

    // ─── Import Map 엔트리 테이블 ───
    if (importMap) {
      const imTitle = document.createElement('div');
      imTitle.style.cssText = 'font-size:13px;font-weight:600;color:#e6edf3;margin:20px 0 10px';
      imTitle.textContent = `Import Map (${Object.keys(importMap.imports).length} entries)`;
      container.appendChild(imTitle);

      const table = document.createElement('div');
      table.style.cssText = 'background:#161b22;border:1px solid #21262d;border-radius:8px;overflow:hidden';

      // 헤더
      const headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:flex;padding:8px 12px;border-bottom:1px solid #21262d;font-size:10px;font-weight:600;color:#7d8590;text-transform:uppercase;letter-spacing:0.5px';
      headerRow.innerHTML = '<span style="width:200px;flex-shrink:0">Specifier</span><span style="flex:1">URL</span><span style="width:60px;text-align:right">Type</span>';
      table.appendChild(headerRow);

      // Import 엔트리
      const sortedImports = Object.entries(importMap.imports).sort(([a], [b]) => a.localeCompare(b));
      for (const [specifier, url] of sortedImports) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;padding:6px 12px;border-bottom:1px solid #161b22;font-size:11px;align-items:center';
        row.addEventListener('mouseenter', () => { row.style.background = '#1c2128'; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; });

        // 앱인지 라이브러리인지 판별
        const isApp = APP_TOPOLOGY.some((a) => specifier.includes(a.name.replace('@enterprise/', '')));
        const typeColor = isApp ? '#60a5fa' : '#c084fc';
        const typeLabel = isApp ? 'App' : 'Lib';

        row.innerHTML = `
          <span style="width:200px;flex-shrink:0;color:#e6edf3;font-weight:500">${escapeHtml(specifier)}</span>
          <span style="flex:1;color:#484f58;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(url)}">${escapeHtml(url)}</span>
          <span style="width:60px;text-align:right;color:${typeColor};font-size:10px;font-weight:500">${typeLabel}</span>
        `;
        table.appendChild(row);
      }

      container.appendChild(table);

      // Scopes 섹션
      if (importMap.scopes && Object.keys(importMap.scopes).length > 0) {
        const scopeTitle = document.createElement('div');
        scopeTitle.style.cssText = 'font-size:12px;font-weight:600;color:#7d8590;margin:14px 0 8px';
        scopeTitle.textContent = `Scoped Overrides (${Object.keys(importMap.scopes).length} scopes)`;
        container.appendChild(scopeTitle);

        for (const [scope, mappings] of Object.entries(importMap.scopes)) {
          const scopeCard = document.createElement('div');
          scopeCard.style.cssText = 'background:#161b22;border:1px solid #21262d;border-radius:6px;padding:8px 12px;margin-bottom:6px';
          scopeCard.innerHTML = `<div style="color:#fbbf24;font-size:11px;font-weight:600;margin-bottom:4px">scope: ${escapeHtml(scope)}</div>`;
          for (const [spec, url] of Object.entries(mappings)) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:8px;font-size:10px;color:#7d8590;padding:2px 0';
            row.innerHTML = `<span style="color:#e6edf3;min-width:150px">${escapeHtml(spec)}</span><span style="overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(url)}">${escapeHtml(url)}</span>`;
            scopeCard.appendChild(row);
          }
          container.appendChild(scopeCard);
        }
      }
    }

    // ─── 의존성 그래프 SVG ───
    const graphTitle = document.createElement('div');
    graphTitle.style.cssText = 'font-size:13px;font-weight:600;color:#e6edf3;margin:20px 0 12px';
    graphTitle.textContent = 'Dependency Graph';
    container.appendChild(graphTitle);

    const svgContainer = document.createElement('div');
    svgContainer.style.cssText = 'background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:16px;position:relative;min-height:200px';
    container.appendChild(svgContainer);

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    svgContainer.appendChild(svgEl);

    // 레이아웃 계산: 앱 노드를 좌측, 모듈 노드를 우측에 배치
    const rect = svgContainer.getBoundingClientRect();
    const svgW = rect.width || 600;
    const moduleNames = [...registered.keys()];
    const appNames = APP_TOPOLOGY.map((a) => a.name);
    const rowHeight = 36;
    const svgH = Math.max(appNames.length, moduleNames.length) * rowHeight + 40;
    svgEl.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svgEl.style.minHeight = `${svgH}px`;

    // Defs (arrow marker)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'dep-arrow');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '5');
    marker.setAttribute('refX', '5');
    marker.setAttribute('refY', '2.5');
    marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,0 L6,2.5 L0,5 Z');
    arrowPath.setAttribute('fill', '#30363d');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svgEl.appendChild(defs);

    const appX = 80;
    const modX = svgW - 120;
    const appPositions: Record<string, number> = {};
    const modPositions: Record<string, number> = {};

    // 앱 노드 (좌측)
    for (const [i, appName] of appNames.entries()) {
      const y = 20 + i * rowHeight + rowHeight / 2;
      appPositions[appName] = y;
      const status = statusCache[appName] ?? 'NOT_LOADED';
      const color = STATUS_COLORS[status] ?? '#6b7280';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(appX));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '14');
      circle.setAttribute('fill', '#161b22');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '1.5');
      svgEl.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(appX));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', '#e6edf3');
      text.setAttribute('font-size', '9');
      text.setAttribute('font-weight', '600');
      text.textContent = APP_TOPOLOGY[i].short;
      svgEl.appendChild(text);
    }

    // 모듈 노드 (우측)
    for (const [i, modName] of moduleNames.entries()) {
      const y = 20 + i * rowHeight + rowHeight / 2;
      modPositions[modName] = y;
      const isLoaded = loaded.has(modName);

      const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect2.setAttribute('x', String(modX - 50));
      rect2.setAttribute('y', String(y - 12));
      rect2.setAttribute('width', '100');
      rect2.setAttribute('height', '24');
      rect2.setAttribute('rx', '12');
      rect2.setAttribute('fill', isLoaded ? '#161b22' : '#0d1117');
      rect2.setAttribute('stroke', isLoaded ? '#3fb950' : '#30363d');
      rect2.setAttribute('stroke-width', '1');
      svgEl.appendChild(rect2);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(modX));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', isLoaded ? '#3fb950' : '#484f58');
      text.setAttribute('font-size', '9');
      text.textContent = modName.length > 14 ? `${modName.slice(0, 12)}…` : modName;
      svgEl.appendChild(text);
    }

    // 엣지: 각 모듈의 provider 앱 → 모듈
    for (const [modName, candidates] of registered) {
      const my = modPositions[modName];
      if (my === undefined) continue;

      for (const candidate of candidates) {
        const providerApp = candidate.from ?? '';
        const ay = appPositions[providerApp];
        if (ay === undefined) continue;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(appX + 16));
        line.setAttribute('y1', String(ay));
        line.setAttribute('x2', String(modX - 52));
        line.setAttribute('y2', String(my));

        const isActiveProvider = loaded.get(modName)?.from === candidate.from;
        line.setAttribute('stroke', isActiveProvider ? '#3fb95060' : '#21262d');
        line.setAttribute('stroke-width', isActiveProvider ? '2' : '1');
        line.setAttribute('marker-end', 'url(#dep-arrow)');
        if (!isActiveProvider) line.setAttribute('stroke-dasharray', '4 3');
        svgEl.appendChild(line);
      }
    }
  }

  // ─── Public API ───

  /** 외부에서 로그 메시지를 패널에 추가한다 */
  function log(message: string): void {
    addEvent({
      timestamp: Date.now(),
      category: classifyMessage(message),
      name: 'log',
      detail: message,
    });
  }

  /** 패널을 파괴하고 정리한다 */
  function destroy(): void {
    style.remove();
    root.innerHTML = '';
    for (const timer of Object.values(glowTimers)) {
      clearTimeout(timer);
    }
  }

  return { log, destroy };
}

// ─── Resize logic ───

/**
 * 드래그로 패널 높이를 조절하는 리사이즈 핸들러를 설정한다.
 * @param handle - 드래그 핸들 요소
 * @param panel - 리사이즈 대상 패널 요소
 */
function setupResize(handle: HTMLElement, panel: HTMLElement): void {
  const state = { dragging: false, startY: 0, startHeight: 0 };

  /** 마우스 다운 시 드래그를 시작한다 */
  const onMouseDown = (e: MouseEvent): void => {
    state.dragging = true;
    state.startY = e.clientY;
    state.startHeight = panel.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  /** 마우스 이동 시 패널 높이를 갱신한다 */
  const onMouseMove = (e: MouseEvent): void => {
    if (!state.dragging) return;
    const delta = state.startY - e.clientY;
    const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, state.startHeight + delta));
    panel.style.height = `${newHeight}px`;
  };

  /** 마우스 업 시 드래그를 종료한다 */
  const onMouseUp = (): void => {
    if (!state.dragging) return;
    state.dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  handle.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
