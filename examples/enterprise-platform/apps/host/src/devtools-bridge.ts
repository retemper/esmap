/**
 * esmap DevTools Bridge.
 *
 * esmap 런타임의 이벤트를 window.postMessage로 브로드캐스트하여
 * Chrome DevTools Extension이 수신할 수 있게 한다.
 * Extension이 없어도 postMessage는 무해하게 무시된다.
 */

/** DevTools bridge가 구독하는 esmap 데이터 소스 옵션 */
interface DevtoolsBridgeOptions {
  readonly registry: {
    readonly getApps: () => ReadonlyArray<{ name: string; status: string; container: string }>;
    readonly onStatusChange: (cb: (e: { appName: string; from: string; to: string }) => void) => () => void;
  };
  readonly eventBus: {
    readonly on: (event: string, handler: (...args: unknown[]) => void) => unknown;
    readonly getHistory: () => ReadonlyArray<{ event: string; payload: unknown; timestamp: number }>;
  };
  readonly globalState: {
    readonly getState: () => Record<string, unknown>;
    readonly subscribe: (cb: (newState: Record<string, unknown>, prevState: Record<string, unknown>) => void) => () => void;
  };
  readonly router: {
    readonly afterRouteChange: (cb: (from: { pathname: string }, to: { pathname: string }) => void) => void;
  };
  readonly perf: {
    readonly onMeasurement?: (cb: (m: { appName: string; phase: string; duration: number; startTime: number }) => void) => () => void;
  };
  readonly prefetch?: {
    readonly getStats: () => ReadonlyArray<{ from: string; to: string; count: number; ratio: number }>;
  };
  readonly sharedModules?: {
    readonly getRegistered: () => ReadonlyMap<string, ReadonlyArray<{ name: string; version: string; requiredVersion?: string; singleton?: boolean; eager?: boolean; from?: string }>>;
    readonly getLoaded: () => ReadonlyMap<string, { version: string; from?: string }>;
  };
  readonly importMap?: {
    readonly imports: Readonly<Record<string, string>>;
    readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  };
}

/** DevTools extension으로 메시지를 브로드캐스트한다 */
function send(payload: Record<string, unknown>): void {
  try {
    window.postMessage({ source: 'esmap-devtools', payload }, window.location.origin);
  } catch {
    // 직렬화 불가능한 데이터가 포함된 경우 무시한다
  }
}

/** 앱 객체에서 직렬화 가능한 필드만 추출한다 */
function serializeApp(app: { name: string; status: string; container: string }): { name: string; status: string; container: string } {
  return { name: app.name, status: app.status, container: app.container };
}

/** 공유 모듈 레지스트리를 직렬화 가능한 형태로 변환한다 */
function serializeSharedModules(
  sm: NonNullable<DevtoolsBridgeOptions['sharedModules']>,
): { registered: Record<string, Array<Record<string, unknown>>>; loaded: Record<string, Record<string, unknown>> } {
  const registered: Record<string, Array<Record<string, unknown>>> = {};
  for (const [name, configs] of sm.getRegistered()) {
    registered[name] = configs.map((c) => ({
      name: c.name, version: c.version, requiredVersion: c.requiredVersion,
      singleton: c.singleton, eager: c.eager, from: c.from,
    }));
  }
  const loaded: Record<string, Record<string, unknown>> = {};
  for (const [name, info] of sm.getLoaded()) {
    loaded[name] = { version: info.version, from: info.from };
  }
  return { registered, loaded };
}

/** 이벤트 이름에서 카테고리를 판별한다 */
function classifyEvent(eventName: string): string {
  if (eventName.includes('auth')) return 'auth';
  if (eventName.includes('route')) return 'route';
  if (eventName.includes('state')) return 'state';
  if (eventName.includes('error') || eventName.includes('fail')) return 'error';
  if (eventName.includes('team') || eventName.includes('task')) return 'lifecycle';
  if (eventName.includes('notification')) return 'lifecycle';
  return 'lifecycle';
}

/** DevTools bridge를 설정한다. Extension이 없어도 안전하게 동작한다 */
export function createDevtoolsBridge(options: DevtoolsBridgeOptions): void {
  const { registry, eventBus, globalState, router, perf, prefetch, sharedModules, importMap } = options;

  /** 스냅샷 캡처용 상태 */
  interface BridgeSnapshot {
    apps: Array<{ name: string; status: string; container: string }>;
    currentState: Record<string, unknown>;
    prefetchStats: Array<{ from: string; to: string; count: number; ratio: number }>;
  }

  const snapshot: BridgeSnapshot = {
    apps: registry.getApps().map(serializeApp),
    currentState: { ...globalState.getState() },
    prefetchStats: [],
  };

  if (prefetch) {
    try { snapshot.prefetchStats = [...prefetch.getStats()]; } catch { /* empty */ }
  }

  // 초기 INIT 메시지 전송
  send({
    type: 'ESMAP_INIT',
    apps: snapshot.apps,
    currentState: snapshot.currentState,
    prefetchStats: snapshot.prefetchStats,
    ...(sharedModules ? { sharedModules: serializeSharedModules(sharedModules) } : {}),
    ...(importMap ? { importMap } : {}),
  });

  // Extension → Page 방향 메시지 수신 (스냅샷 요청 등)
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.source !== 'esmap-devtools-panel') return;

    const msg = event.data.payload;
    if (msg?.type === 'ESMAP_GET_SNAPSHOT') {
      send({
        type: 'ESMAP_INIT',
        apps: snapshot.apps,
        currentState: snapshot.currentState,
        prefetchStats: snapshot.prefetchStats,
        ...(sharedModules ? { sharedModules: serializeSharedModules(sharedModules) } : {}),
      });
    }
  });

  // 레지스트리 상태 변경
  registry.onStatusChange((event) => {
    // 스냅샷 갱신
    const idx = snapshot.apps.findIndex((a) => a.name === event.appName);
    if (idx >= 0) {
      snapshot.apps[idx] = { ...snapshot.apps[idx], status: event.to };
    }

    send({
      type: 'ESMAP_STATUS_CHANGE',
      appName: event.appName,
      from: event.from,
      to: event.to,
      timestamp: Date.now(),
    });
  });

  // 이벤트 버스 — 알려진 이벤트 구독
  const knownEvents = [
    'auth:login', 'auth:logout', 'activity:new', 'lifecycle',
    'team:member-select', 'team:member-deselect',
    'task:select', 'task:deselect', 'task:status-change',
    'notification:click',
  ];
  for (const eventName of knownEvents) {
    try {
      eventBus.on(eventName, (payload: unknown) => {
        send({
          type: 'ESMAP_EVENT',
          event: eventName,
          payload: JSON.stringify(payload),
          category: classifyEvent(eventName),
          timestamp: Date.now(),
        });
      });
    } catch { /* unsupported event */ }
  }

  // 글로벌 상태 구독
  globalState.subscribe((newState, prevState) => {
    snapshot.currentState = { ...newState };
    send({
      type: 'ESMAP_STATE_CHANGE',
      newState: { ...newState },
      prevState: { ...prevState },
      timestamp: Date.now(),
    });

    if (prefetch) {
      try {
        snapshot.prefetchStats = [...prefetch.getStats()];
        send({
          type: 'ESMAP_PREFETCH_STATS',
          stats: snapshot.prefetchStats,
          timestamp: Date.now(),
        });
      } catch { /* empty */ }
    }
  });

  // 라우터 이벤트
  router.afterRouteChange((from, to) => {
    send({
      type: 'ESMAP_ROUTE_CHANGE',
      from: from.pathname,
      to: to.pathname,
      timestamp: Date.now(),
    });
  });

  // 성능 측정 구독
  if (perf.onMeasurement) {
    try {
      perf.onMeasurement((measurement) => {
        send({
          type: 'ESMAP_PERF',
          appName: measurement.appName,
          phase: measurement.phase,
          duration: measurement.duration,
          startTime: measurement.startTime,
          timestamp: Date.now(),
        });
      });
    } catch { /* empty */ }
  }

  // 기존 이벤트 히스토리 전송
  try {
    const history = eventBus.getHistory();
    for (const item of history) {
      send({
        type: 'ESMAP_EVENT',
        event: String(item.event),
        payload: JSON.stringify(item.payload),
        category: classifyEvent(String(item.event)),
        timestamp: item.timestamp,
      });
    }
  } catch { /* empty */ }

  console.log('[esmap] DevTools bridge active');
}
