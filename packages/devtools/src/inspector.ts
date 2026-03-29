/**
 * 런타임 프레임워크 상태를 검사하는 devtools inspector.
 * 이벤트 버스, 공유 모듈, 앱 레지스트리의 상태를 콘솔에서 조회할 수 있다.
 *
 * 설계 원칙: Inspector는 프레임워크 패키지를 직접 import하지 않는다.
 * 대신 `connect()`로 런타임 객체의 참조를 받아 약한 결합을 유지한다.
 */

/** 이벤트 버스 검사용 최소 인터페이스 */
interface InspectableEventBus {
  readonly getHistory: (event?: string) => ReadonlyArray<{
    readonly event: string;
    readonly payload: unknown;
    readonly timestamp: number;
  }>;
  readonly listenerCount: (event: string) => number;
}

/** 공유 모듈 레지스트리 검사용 최소 인터페이스 */
interface InspectableSharedModules {
  readonly getRegistered: () => ReadonlyMap<string, ReadonlyArray<{
    readonly name: string;
    readonly version: string;
    readonly requiredVersion?: string;
    readonly singleton?: boolean;
    readonly eager?: boolean;
    readonly from?: string;
  }>>;
  readonly getLoaded: () => ReadonlyMap<string, {
    readonly version: string;
    readonly module: unknown;
    readonly from?: string;
  }>;
}

/** 앱 레지스트리 검사용 최소 인터페이스 */
interface InspectableRegistry {
  readonly getApps: () => ReadonlyArray<{
    readonly name: string;
    readonly status: string;
    readonly container: string;
  }>;
}

/** Inspector에 연결 가능한 리소스 */
interface InspectorConnections {
  readonly eventBus?: InspectableEventBus;
  readonly sharedModules?: InspectableSharedModules;
  readonly registry?: InspectableRegistry;
}

/** DevTools Inspector 인터페이스 */
export interface DevtoolsInspector {
  /** 런타임 리소스를 연결한다. 여러 번 호출하면 마지막 연결이 유지된다. */
  connect(connections: InspectorConnections): void;
  /** 이벤트 버스 이력을 콘솔에 출력한다 */
  events(filter?: string): void;
  /** 특정 이벤트의 리스너 수를 출력한다 */
  listeners(event: string): void;
  /** 공유 모듈 등록/로드 상태를 콘솔에 출력한다 */
  shared(): void;
  /** 앱 상태 목록을 콘솔에 출력한다 */
  apps(): void;
  /** 연결 상태를 확인한다 */
  status(): void;
}

/**
 * DevTools Inspector를 생성한다.
 * `connect()`로 런타임 리소스를 연결한 후 이벤트/모듈/앱 상태를 조회할 수 있다.
 *
 * @example
 * ```ts
 * const inspector = createDevtoolsInspector();
 * inspector.connect({ eventBus: comm.resources.eventBus, sharedModules, registry });
 * inspector.events();       // 전체 이벤트 이력
 * inspector.events('user:*'); // 'user:' 시작 이벤트만
 * inspector.shared();       // 공유 모듈 상태
 * inspector.apps();         // 앱 상태
 * ```
 *
 * @returns DevtoolsInspector 인스턴스
 */
export function createDevtoolsInspector(): DevtoolsInspector {
  const connections: { current: InspectorConnections } = { current: {} };

  return {
    connect(conns: InspectorConnections): void {
      connections.current = conns;
      console.log('[esmap:inspector] 연결됨:', formatConnectionStatus(conns));
    },

    events(filter?: string): void {
      const bus = connections.current.eventBus;
      if (!bus) {
        console.warn('[esmap:inspector] EventBus가 연결되지 않았습니다. connect()를 먼저 호출하세요.');
        return;
      }

      const history = bus.getHistory();
      const filtered = filter
        ? history.filter((record) => matchesPattern(record.event, filter))
        : history;

      if (filtered.length === 0) {
        console.log(`[esmap:inspector] 이벤트 이력 없음${filter ? ` (필터: "${filter}")` : ''}`);
        return;
      }

      console.group(`[esmap:inspector] 이벤트 이력 (${filtered.length}건${filter ? `, 필터: "${filter}"` : ''})`);
      for (const record of filtered) {
        const time = new Date(record.timestamp).toISOString().slice(11, 23);
        console.log(`[${time}] ${record.event}`, record.payload);
      }
      console.groupEnd();
    },

    listeners(event: string): void {
      const bus = connections.current.eventBus;
      if (!bus) {
        console.warn('[esmap:inspector] EventBus가 연결되지 않았습니다.');
        return;
      }

      const count = bus.listenerCount(event);
      console.log(`[esmap:inspector] "${event}" 리스너: ${count}개`);
    },

    shared(): void {
      const modules = connections.current.sharedModules;
      if (!modules) {
        console.warn('[esmap:inspector] SharedModuleRegistry가 연결되지 않았습니다.');
        return;
      }

      const registered = modules.getRegistered();
      const loaded = modules.getLoaded();

      console.group(`[esmap:inspector] 공유 모듈 (등록: ${registered.size}, 로드: ${loaded.size})`);

      for (const [name, candidates] of registered) {
        const loadedInfo = loaded.get(name);
        const status = loadedInfo ? `로드됨 v${loadedInfo.version}` : '미로드';
        const versions = candidates.map((c) => c.version).join(', ');
        const flags: string[] = [];
        if (candidates.some((c) => c.singleton)) flags.push('singleton');
        if (candidates.some((c) => c.eager)) flags.push('eager');
        const from = loadedInfo?.from ? ` (from: ${loadedInfo.from})` : '';

        console.log(
          `  ${name}: [${versions}] → ${status}${from}${flags.length > 0 ? ` [${flags.join(', ')}]` : ''}`,
        );
      }

      console.groupEnd();
    },

    apps(): void {
      const registry = connections.current.registry;
      if (!registry) {
        console.warn('[esmap:inspector] AppRegistry가 연결되지 않았습니다.');
        return;
      }

      const apps = registry.getApps();
      if (apps.length === 0) {
        console.log('[esmap:inspector] 등록된 앱 없음');
        return;
      }

      console.group(`[esmap:inspector] 앱 목록 (${apps.length}개)`);
      for (const app of apps) {
        console.log(`  ${app.name}: ${app.status} → ${app.container}`);
      }
      console.groupEnd();
    },

    status(): void {
      console.log('[esmap:inspector] 연결 상태:', formatConnectionStatus(connections.current));
    },
  };
}

/**
 * 와일드카드 패턴이 이벤트 이름과 매칭되는지 확인한다.
 * 'user:*'는 'user:'로 시작하는 모든 이벤트에 매칭된다.
 * 와일드카드가 없으면 정확 일치를 확인한다.
 * @param event - 이벤트 이름
 * @param pattern - 매칭 패턴 (와일드카드 * 지원)
 */
function matchesPattern(event: string, pattern: string): boolean {
  if (pattern.endsWith('*')) {
    return event.startsWith(pattern.slice(0, -1));
  }
  return event === pattern;
}

/**
 * 연결 상태를 사람이 읽을 수 있는 문자열로 포맷한다.
 * @param conns - 현재 연결 상태
 */
function formatConnectionStatus(conns: InspectorConnections): string {
  const parts: string[] = [];
  parts.push(`EventBus: ${conns.eventBus ? '연결' : '미연결'}`);
  parts.push(`SharedModules: ${conns.sharedModules ? '연결' : '미연결'}`);
  parts.push(`Registry: ${conns.registry ? '연결' : '미연결'}`);
  return parts.join(', ');
}
