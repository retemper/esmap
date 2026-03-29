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
    it('자원을 등록하고 준비 완료 처리한다', () => {
      const gate = createReadyGate();

      gate.register('auth');
      gate.markReady('auth');

      const status = gate.getStatus();
      expect(status).toHaveLength(1);
      expect(status[0].name).toBe('auth');
      expect(status[0].ready).toBe(true);
      expect(status[0].readyAt).toBeTypeOf('number');
    });

    it('같은 자원을 두 번 등록해도 중복되지 않는다', () => {
      const gate = createReadyGate();

      gate.register('auth');
      gate.register('auth');

      expect(gate.getStatus()).toHaveLength(1);
    });

    it('미등록 자원을 markReady하면 암시적으로 등록된다', () => {
      const gate = createReadyGate();

      gate.markReady('config');

      expect(gate.getStatus()).toHaveLength(1);
      expect(gate.getStatus()[0].ready).toBe(true);
    });
  });

  describe('waitFor — 단일 자원 대기', () => {
    it('이미 준비된 자원에 대해 즉시 resolve한다', async () => {
      const gate = createReadyGate();

      gate.markReady('auth');
      await gate.waitFor('auth');
      // resolve 확인 — 에러 없이 통과
    });

    it('미준비 자원에 대해 markReady될 때까지 대기한다', async () => {
      const gate = createReadyGate();
      gate.register('auth');

      const resolved = vi.fn();
      const promise = gate.waitFor('auth').then(resolved);

      // 아직 resolve되지 않음
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).not.toHaveBeenCalled();

      // markReady 호출
      gate.markReady('auth');
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(resolved).toHaveBeenCalled();
    });

    it('타임아웃 시간 내에 준비되지 않으면 reject한다', async () => {
      const gate = createReadyGate({ timeout: 100 });
      gate.register('auth');

      const promise = gate.waitFor('auth');

      // rejection handler를 먼저 등록하여 unhandled rejection 방지
      const rejection = expect(promise).rejects.toThrow('ReadyGate 타임아웃');

      await vi.advanceTimersByTimeAsync(100);

      await rejection;
    });

    it('미등록 자원을 waitFor하면 암시적으로 등록된다', async () => {
      const gate = createReadyGate();

      const resolved = vi.fn();
      gate.waitFor('unknown').then(resolved);

      gate.markReady('unknown');
      await vi.advanceTimersByTimeAsync(0);

      expect(resolved).toHaveBeenCalled();
      expect(gate.getStatus()).toHaveLength(1);
    });
  });

  describe('waitForAll — 모든 자원 대기', () => {
    it('모든 자원이 준비되면 resolve한다', async () => {
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

    it('등록된 자원이 없으면 즉시 resolve한다', async () => {
      const gate = createReadyGate();

      await gate.waitForAll();
      // 에러 없이 통과
    });

    it('모든 자원이 이미 준비되어 있으면 즉시 resolve한다', async () => {
      const gate = createReadyGate();
      gate.markReady('a');
      gate.markReady('b');

      await gate.waitForAll();
      // 에러 없이 통과
    });
  });

  describe('waitForMany — 특정 자원 목록 대기', () => {
    it('지정된 자원만 대기한다', async () => {
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
      // analytics는 아직 미준비지만 상관없음
      expect(gate.isAllReady()).toBe(false);
    });
  });

  describe('isAllReady', () => {
    it('모든 자원이 준비되면 true를 반환한다', () => {
      const gate = createReadyGate();
      gate.register('a');
      gate.register('b');

      expect(gate.isAllReady()).toBe(false);

      gate.markReady('a');
      expect(gate.isAllReady()).toBe(false);

      gate.markReady('b');
      expect(gate.isAllReady()).toBe(true);
    });

    it('자원이 없으면 true를 반환한다', () => {
      const gate = createReadyGate();

      expect(gate.isAllReady()).toBe(true);
    });
  });

  describe('reset', () => {
    it('모든 등록과 상태를 초기화한다', () => {
      const gate = createReadyGate();
      gate.register('auth');
      gate.markReady('auth');

      gate.reset();

      expect(gate.getStatus()).toHaveLength(0);
      expect(gate.isAllReady()).toBe(true);
    });
  });

  describe('여러 대기자 동시 해소', () => {
    it('같은 자원을 여러 곳에서 waitFor해도 모두 resolve된다', async () => {
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
