import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReadyGate } from './ready-gate.js';

describe('createReadyGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('register + markReady', () => {
    it('registers a resource and marks it as ready', () => {
      const gate = createReadyGate();

      gate.register('auth');
      gate.markReady('auth');

      const status = gate.getStatus();
      expect(status).toHaveLength(1);
      expect(status[0].name).toBe('auth');
      expect(status[0].ready).toBe(true);
      expect(status[0].readyAt).toBeTypeOf('number');
    });

    it('does not duplicate when registering the same resource twice', () => {
      const gate = createReadyGate();

      gate.register('auth');
      gate.register('auth');

      expect(gate.getStatus()).toHaveLength(1);
    });

    it('implicitly registers when markReady is called on an unregistered resource', () => {
      const gate = createReadyGate();

      gate.markReady('config');

      expect(gate.getStatus()).toHaveLength(1);
      expect(gate.getStatus()[0].ready).toBe(true);
    });
  });

  describe('waitFor — single resource wait', () => {
    it('resolves immediately for an already ready resource', async () => {
      const gate = createReadyGate();

      gate.markReady('auth');
      await gate.waitFor('auth');
      // Confirm resolve — passes without error
    });

    it('waits until markReady is called for an unready resource', async () => {
      const gate = createReadyGate();
      gate.register('auth');

      const resolved = vi.fn();
      const promise = gate.waitFor('auth').then(resolved);

      // Not yet resolved
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).not.toHaveBeenCalled();

      // Call markReady
      gate.markReady('auth');
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(resolved).toHaveBeenCalled();
    });

    it('rejects if not ready within the timeout', async () => {
      const gate = createReadyGate({ timeout: 100 });
      gate.register('auth');

      const promise = gate.waitFor('auth');

      // Register rejection handler first to prevent unhandled rejection
      const rejection = expect(promise).rejects.toThrow('ReadyGate timed out');

      await vi.advanceTimersByTimeAsync(100);

      await rejection;
    });

    it('implicitly registers when waitFor is called on an unregistered resource', async () => {
      const gate = createReadyGate();

      const resolved = vi.fn();
      gate.waitFor('unknown').then(resolved);

      gate.markReady('unknown');
      await vi.advanceTimersByTimeAsync(0);

      expect(resolved).toHaveBeenCalled();
      expect(gate.getStatus()).toHaveLength(1);
    });
  });

  describe('waitForAll — wait for all resources', () => {
    it('resolves when all resources are ready', async () => {
      const gate = createReadyGate();
      gate.register('auth');
      gate.register('config');

      const resolved = vi.fn();
      const promise = gate.waitForAll().then(resolved);

      gate.markReady('auth');
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).not.toHaveBeenCalled();

      gate.markReady('config');
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(resolved).toHaveBeenCalled();
    });

    it('resolves immediately when no resources are registered', async () => {
      const gate = createReadyGate();

      await gate.waitForAll();
      // passes without error
    });

    it('resolves immediately when all resources are already ready', async () => {
      const gate = createReadyGate();
      gate.markReady('a');
      gate.markReady('b');

      await gate.waitForAll();
      // passes without error
    });
  });

  describe('waitForMany — wait for specific resource list', () => {
    it('waits only for the specified resources', async () => {
      const gate = createReadyGate();
      gate.register('auth');
      gate.register('config');
      gate.register('analytics');

      const resolved = vi.fn();
      const promise = gate.waitForMany(['auth', 'config']).then(resolved);

      gate.markReady('auth');
      gate.markReady('config');
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(resolved).toHaveBeenCalled();
      // analytics is not yet ready, but that does not matter
      expect(gate.isAllReady()).toBe(false);
    });
  });

  describe('isAllReady', () => {
    it('returns true when all resources are ready', () => {
      const gate = createReadyGate();
      gate.register('a');
      gate.register('b');

      expect(gate.isAllReady()).toBe(false);

      gate.markReady('a');
      expect(gate.isAllReady()).toBe(false);

      gate.markReady('b');
      expect(gate.isAllReady()).toBe(true);
    });

    it('returns true when no resources are registered', () => {
      const gate = createReadyGate();

      expect(gate.isAllReady()).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets all registrations and states', () => {
      const gate = createReadyGate();
      gate.register('auth');
      gate.markReady('auth');

      gate.reset();

      expect(gate.getStatus()).toHaveLength(0);
      expect(gate.isAllReady()).toBe(true);
    });
  });

  describe('resolving multiple waiters simultaneously', () => {
    it('resolves all waiters when multiple waitFor calls target the same resource', async () => {
      const gate = createReadyGate();
      gate.register('auth');

      const resolved1 = vi.fn();
      const resolved2 = vi.fn();
      const p1 = gate.waitFor('auth').then(resolved1);
      const p2 = gate.waitFor('auth').then(resolved2);

      gate.markReady('auth');
      await vi.advanceTimersByTimeAsync(0);
      await Promise.all([p1, p2]);

      expect(resolved1).toHaveBeenCalled();
      expect(resolved2).toHaveBeenCalled();
    });
  });
});
