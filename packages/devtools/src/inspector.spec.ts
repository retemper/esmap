import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDevtoolsInspector } from './inspector.js';
import type { DevtoolsInspector } from './inspector.js';

describe('createDevtoolsInspector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /** 테스트용 이벤트 버스 stub을 생성한다 */
  function createMockEventBus(
    history: ReadonlyArray<{ event: string; payload: unknown; timestamp: number }> = [],
    listenerCounts: Record<string, number> = {},
  ) {
    return {
      getHistory: (event?: string) =>
        event ? history.filter((h) => h.event === event) : history,
      listenerCount: (event: string) => listenerCounts[event] ?? 0,
    };
  }

  /** 테스트용 공유 모듈 레지스트리 stub을 생성한다 */
  function createMockSharedModules(
    registered: ReadonlyMap<string, ReadonlyArray<{ name: string; version: string; singleton?: boolean; eager?: boolean; from?: string }>> = new Map(),
    loaded: ReadonlyMap<string, { version: string; module: unknown; from?: string }> = new Map(),
  ) {
    return {
      getRegistered: () => registered,
      getLoaded: () => loaded,
    };
  }

  /** 테스트용 앱 레지스트리 stub을 생성한다 */
  function createMockRegistry(
    apps: ReadonlyArray<{ name: string; status: string; container: string }> = [],
  ) {
    return {
      getApps: () => apps,
    };
  }

  describe('connect', () => {
    it('연결 상태를 콘솔에 출력한다', () => {
      const inspector = createDevtoolsInspector();
      const logSpy = vi.spyOn(console, 'log');

      inspector.connect({
        eventBus: createMockEventBus(),
        sharedModules: createMockSharedModules(),
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('연결됨'),
        expect.stringContaining('EventBus: 연결'),
      );
    });

    it('마지막 연결이 유지된다', () => {
      const inspector = createDevtoolsInspector();
      const bus1 = createMockEventBus([
        { event: 'old', payload: null, timestamp: 1000 },
      ]);
      const bus2 = createMockEventBus([
        { event: 'new', payload: null, timestamp: 2000 },
      ]);

      inspector.connect({ eventBus: bus1 });
      inspector.connect({ eventBus: bus2 });

      const logSpy = vi.spyOn(console, 'log');
      inspector.events();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('1건'),
      );
    });
  });

  describe('events', () => {
    it('EventBus 미연결 시 경고를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.events();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EventBus가 연결되지 않았습니다'),
      );
    });

    it('이력이 없으면 없음 메시지를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({ eventBus: createMockEventBus() });

      const logSpy = vi.spyOn(console, 'log');
      inspector.events();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('이벤트 이력 없음'),
      );
    });

    it('전체 이벤트 이력을 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([
          { event: 'user:login', payload: { id: 1 }, timestamp: 1000 },
          { event: 'app:mounted', payload: null, timestamp: 2000 },
        ]),
      });

      const groupSpy = vi.spyOn(console, 'group');
      const logSpy = vi.spyOn(console, 'log');
      const groupEndSpy = vi.spyOn(console, 'groupEnd');

      inspector.events();

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('2건'));
      // 이벤트 2건이 각각 출력된다
      const logCalls = logSpy.mock.calls.map((args) => args[0] as string);
      expect(logCalls.some((msg) => msg.includes('user:login'))).toBe(true);
      expect(logCalls.some((msg) => msg.includes('app:mounted'))).toBe(true);
      expect(groupEndSpy).toHaveBeenCalled();
    });

    it('와일드카드 필터로 이벤트를 필터링한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([
          { event: 'user:login', payload: null, timestamp: 1000 },
          { event: 'user:logout', payload: null, timestamp: 2000 },
          { event: 'app:mounted', payload: null, timestamp: 3000 },
        ]),
      });

      const groupSpy = vi.spyOn(console, 'group');
      inspector.events('user:*');

      expect(groupSpy).toHaveBeenCalledWith(
        expect.stringContaining('2건'),
      );
      expect(groupSpy).toHaveBeenCalledWith(
        expect.stringContaining('필터: "user:*"'),
      );
    });

    it('필터에 매칭되는 이벤트가 없으면 없음 메시지를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([
          { event: 'app:mounted', payload: null, timestamp: 1000 },
        ]),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.events('user:*');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('필터: "user:*"'),
      );
    });

    it('정확 일치 필터를 지원한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([
          { event: 'user:login', payload: null, timestamp: 1000 },
          { event: 'user:logout', payload: null, timestamp: 2000 },
        ]),
      });

      const groupSpy = vi.spyOn(console, 'group');
      inspector.events('user:login');

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('1건'));
    });
  });

  describe('listeners', () => {
    it('EventBus 미연결 시 경고를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.listeners('some:event');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EventBus가 연결되지 않았습니다'),
      );
    });

    it('특정 이벤트의 리스너 수를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([], { 'user:login': 3 }),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.listeners('user:login');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('"user:login" 리스너: 3개'),
      );
    });

    it('리스너가 없는 이벤트는 0을 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([], {}),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.listeners('unknown:event');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('리스너: 0개'),
      );
    });
  });

  describe('shared', () => {
    it('SharedModuleRegistry 미연결 시 경고를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.shared();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SharedModuleRegistry가 연결되지 않았습니다'),
      );
    });

    it('등록/로드 상태를 출력한다', () => {
      const registered = new Map([
        ['react', [{ name: 'react', version: '18.2.0', singleton: true }]],
        ['lodash', [{ name: 'lodash', version: '4.17.0' }, { name: 'lodash', version: '4.18.0' }]],
      ]);
      const loaded = new Map([
        ['react', { version: '18.2.0', module: {}, from: 'host' }],
      ]);

      const inspector = createDevtoolsInspector();
      inspector.connect({
        sharedModules: createMockSharedModules(registered, loaded),
      });

      const groupSpy = vi.spyOn(console, 'group');
      const logSpy = vi.spyOn(console, 'log');
      const groupEndSpy = vi.spyOn(console, 'groupEnd');

      inspector.shared();

      expect(groupSpy).toHaveBeenCalledWith(
        expect.stringContaining('등록: 2, 로드: 1'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('react'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('singleton'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('from: host'),
      );
      expect(groupEndSpy).toHaveBeenCalled();
    });

    it('미로드 모듈은 미로드로 표시한다', () => {
      const registered = new Map([
        ['vue', [{ name: 'vue', version: '3.3.0' }]],
      ]);

      const inspector = createDevtoolsInspector();
      inspector.connect({
        sharedModules: createMockSharedModules(registered, new Map()),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.shared();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('미로드'));
    });
  });

  describe('apps', () => {
    it('AppRegistry 미연결 시 경고를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.apps();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('AppRegistry가 연결되지 않았습니다'),
      );
    });

    it('등록된 앱이 없으면 없음 메시지를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({ registry: createMockRegistry() });

      const logSpy = vi.spyOn(console, 'log');
      inspector.apps();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('등록된 앱 없음'),
      );
    });

    it('앱 목록을 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        registry: createMockRegistry([
          { name: 'app-home', status: 'MOUNTED', container: '#home' },
          { name: 'app-settings', status: 'NOT_LOADED', container: '#settings' },
        ]),
      });

      const groupSpy = vi.spyOn(console, 'group');
      const logSpy = vi.spyOn(console, 'log');
      const groupEndSpy = vi.spyOn(console, 'groupEnd');

      inspector.apps();

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('2개'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('app-home'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MOUNTED'));
      expect(groupEndSpy).toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('연결되지 않은 상태를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      const logSpy = vi.spyOn(console, 'log');

      inspector.status();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('연결 상태'),
        expect.stringContaining('미연결'),
      );
    });

    it('모든 리소스 연결 후 상태를 출력한다', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus(),
        sharedModules: createMockSharedModules(),
        registry: createMockRegistry(),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.status();

      const statusOutput = logSpy.mock.calls
        .map((call) => call.join(' '))
        .join(' ');
      expect(statusOutput).toContain('EventBus: 연결');
      expect(statusOutput).toContain('SharedModules: 연결');
      expect(statusOutput).toContain('Registry: 연결');
    });
  });
});
