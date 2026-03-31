import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDevtoolsInspector } from './inspector.js';
import type { DevtoolsInspector } from './inspector.js';

describe('createDevtoolsInspector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /** Creates a mock event bus stub for testing */
  function createMockEventBus(
    history: ReadonlyArray<{ event: string; payload: unknown; timestamp: number }> = [],
    listenerCounts: Record<string, number> = {},
  ) {
    return {
      getHistory: (event?: string) => (event ? history.filter((h) => h.event === event) : history),
      listenerCount: (event: string) => listenerCounts[event] ?? 0,
    };
  }

  /** Creates a mock shared module registry stub for testing */
  function createMockSharedModules(
    registered: ReadonlyMap<
      string,
      ReadonlyArray<{
        name: string;
        version: string;
        singleton?: boolean;
        eager?: boolean;
        from?: string;
      }>
    > = new Map(),
    loaded: ReadonlyMap<string, { version: string; module: unknown; from?: string }> = new Map(),
  ) {
    return {
      getRegistered: () => registered,
      getLoaded: () => loaded,
    };
  }

  /** Creates a mock app registry stub for testing */
  function createMockRegistry(
    apps: ReadonlyArray<{ name: string; status: string; container: string }> = [],
  ) {
    return {
      getApps: () => apps,
    };
  }

  describe('connect', () => {
    it('prints connection status to the console', () => {
      const inspector = createDevtoolsInspector();
      const logSpy = vi.spyOn(console, 'log');

      inspector.connect({
        eventBus: createMockEventBus(),
        sharedModules: createMockSharedModules(),
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connected'),
        expect.stringContaining('EventBus: connected'),
      );
    });

    it('retains the latest connection', () => {
      const inspector = createDevtoolsInspector();
      const bus1 = createMockEventBus([{ event: 'old', payload: null, timestamp: 1000 }]);
      const bus2 = createMockEventBus([{ event: 'new', payload: null, timestamp: 2000 }]);

      inspector.connect({ eventBus: bus1 });
      inspector.connect({ eventBus: bus2 });

      const logSpy = vi.spyOn(console, 'log');
      inspector.events();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 entries'));
    });
  });

  describe('events', () => {
    it('prints a warning when EventBus is not connected', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.events();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('EventBus is not connected'));
    });

    it('prints an empty message when there is no history', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({ eventBus: createMockEventBus() });

      const logSpy = vi.spyOn(console, 'log');
      inspector.events();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No event history'));
    });

    it('prints the full event history', () => {
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

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('2 entries'));
      // Both events are printed individually
      const logCalls = logSpy.mock.calls.map((args) => args[0] as string);
      expect(logCalls.some((msg) => msg.includes('user:login'))).toBe(true);
      expect(logCalls.some((msg) => msg.includes('app:mounted'))).toBe(true);
      expect(groupEndSpy).toHaveBeenCalled();
    });

    it('filters events using a wildcard filter', () => {
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

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('2 entries'));
      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('filter: "user:*"'));
    });

    it('prints an empty message when no events match the filter', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([{ event: 'app:mounted', payload: null, timestamp: 1000 }]),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.events('user:*');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('filter: "user:*"'));
    });

    it('supports exact match filtering', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([
          { event: 'user:login', payload: null, timestamp: 1000 },
          { event: 'user:logout', payload: null, timestamp: 2000 },
        ]),
      });

      const groupSpy = vi.spyOn(console, 'group');
      inspector.events('user:login');

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('1 entries'));
    });
  });

  describe('listeners', () => {
    it('prints a warning when EventBus is not connected', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.listeners('some:event');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('EventBus is not connected'));
    });

    it('prints the listener count for a specific event', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([], { 'user:login': 3 }),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.listeners('user:login');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"user:login" listeners: 3'));
    });

    it('prints 0 for events with no listeners', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus([], {}),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.listeners('unknown:event');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('listeners: 0'));
    });
  });

  describe('shared', () => {
    it('prints a warning when SharedModuleRegistry is not connected', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.shared();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SharedModuleRegistry is not connected'),
      );
    });

    it('prints registration and loading status', () => {
      const registered = new Map([
        ['react', [{ name: 'react', version: '18.2.0', singleton: true }]],
        [
          'lodash',
          [
            { name: 'lodash', version: '4.17.0' },
            { name: 'lodash', version: '4.18.0' },
          ],
        ],
      ]);
      const loaded = new Map([['react', { version: '18.2.0', module: {}, from: 'host' }]]);

      const inspector = createDevtoolsInspector();
      inspector.connect({
        sharedModules: createMockSharedModules(registered, loaded),
      });

      const groupSpy = vi.spyOn(console, 'group');
      const logSpy = vi.spyOn(console, 'log');
      const groupEndSpy = vi.spyOn(console, 'groupEnd');

      inspector.shared();

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('registered: 2, loaded: 1'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('react'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('singleton'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('from: host'));
      expect(groupEndSpy).toHaveBeenCalled();
    });

    it('marks unloaded modules as not loaded', () => {
      const registered = new Map([['vue', [{ name: 'vue', version: '3.3.0' }]]]);

      const inspector = createDevtoolsInspector();
      inspector.connect({
        sharedModules: createMockSharedModules(registered, new Map()),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.shared();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not loaded'));
    });
  });

  describe('apps', () => {
    it('prints a warning when AppRegistry is not connected', () => {
      const inspector = createDevtoolsInspector();
      const warnSpy = vi.spyOn(console, 'warn');

      inspector.apps();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('AppRegistry is not connected'));
    });

    it('prints an empty message when no apps are registered', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({ registry: createMockRegistry() });

      const logSpy = vi.spyOn(console, 'log');
      inspector.apps();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No registered apps'));
    });

    it('prints the app list', () => {
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

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('(2)'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('app-home'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MOUNTED'));
      expect(groupEndSpy).toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('prints the disconnected state', () => {
      const inspector = createDevtoolsInspector();
      const logSpy = vi.spyOn(console, 'log');

      inspector.status();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection status'),
        expect.stringContaining('disconnected'),
      );
    });

    it('prints status after connecting all resources', () => {
      const inspector = createDevtoolsInspector();
      inspector.connect({
        eventBus: createMockEventBus(),
        sharedModules: createMockSharedModules(),
        registry: createMockRegistry(),
      });

      const logSpy = vi.spyOn(console, 'log');
      inspector.status();

      const statusOutput = logSpy.mock.calls.map((call) => call.join(' ')).join(' ');
      expect(statusOutput).toContain('EventBus: connected');
      expect(statusOutput).toContain('SharedModules: connected');
      expect(statusOutput).toContain('Registry: connected');
    });
  });
});
