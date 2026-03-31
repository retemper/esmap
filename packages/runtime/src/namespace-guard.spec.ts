import { describe, it, expect, vi } from 'vitest';
import { createNamespaceGuard } from './namespace-guard.js';

describe('createNamespaceGuard', () => {
  describe('claim — key registration', () => {
    it('succeeds when registering an unregistered key', () => {
      const guard = createNamespaceGuard();

      expect(guard.claim('theme', 'app-a')).toBe(true);
      expect(guard.getOwner('theme')).toBe('app-a');
    });

    it('succeeds when the same owner re-registers the same key', () => {
      const guard = createNamespaceGuard();

      guard.claim('theme', 'app-a');

      expect(guard.claim('theme', 'app-a')).toBe(true);
    });

    it('returns false in warn mode when a different owner registers the same key', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const guard = createNamespaceGuard({ onConflict: 'warn' });

      guard.claim('theme', 'app-a');
      const result = guard.claim('theme', 'app-b');

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Namespace conflict'),
      );

      warnSpy.mockRestore();
    });

    it('throws in error mode when a different owner registers the same key', () => {
      const guard = createNamespaceGuard({ onConflict: 'error' });

      guard.claim('theme', 'app-a');

      expect(() => guard.claim('theme', 'app-b')).toThrow('Namespace conflict');
    });

    it('returns false silently in skip mode when a different owner registers the same key', () => {
      const guard = createNamespaceGuard({ onConflict: 'skip' });

      guard.claim('theme', 'app-a');
      const result = guard.claim('theme', 'app-b');

      expect(result).toBe(false);
    });
  });

  describe('allowedSharedKeys — shared key allowlist', () => {
    it('does not conflict when multiple apps register an allowed shared key', () => {
      const guard = createNamespaceGuard({
        onConflict: 'error',
        allowedSharedKeys: ['locale', 'auth-token'],
      });

      expect(guard.claim('locale', 'app-a')).toBe(true);
      expect(guard.claim('locale', 'app-b')).toBe(true);
    });

    it('retains the first registrant as the owner of a shared key', () => {
      const guard = createNamespaceGuard({
        allowedSharedKeys: ['locale'],
      });

      guard.claim('locale', 'app-a');
      guard.claim('locale', 'app-b');

      expect(guard.getOwner('locale')).toBe('app-a');
    });
  });

  describe('release — key release', () => {
    it('allows the owner to release their own key', () => {
      const guard = createNamespaceGuard();

      guard.claim('theme', 'app-a');
      guard.release('theme', 'app-a');

      expect(guard.getOwner('theme')).toBeUndefined();
    });

    it('cannot release a key owned by another owner', () => {
      const guard = createNamespaceGuard();

      guard.claim('theme', 'app-a');
      guard.release('theme', 'app-b');

      expect(guard.getOwner('theme')).toBe('app-a');
    });

    it('allows another app to register the same key after release', () => {
      const guard = createNamespaceGuard({ onConflict: 'error' });

      guard.claim('theme', 'app-a');
      guard.release('theme', 'app-a');

      expect(guard.claim('theme', 'app-b')).toBe(true);
      expect(guard.getOwner('theme')).toBe('app-b');
    });
  });

  describe('releaseAll — bulk release by app', () => {
    it('releases all keys owned by a specific app', () => {
      const guard = createNamespaceGuard();

      guard.claim('theme', 'app-a');
      guard.claim('lang', 'app-a');
      guard.claim('user', 'app-b');

      guard.releaseAll('app-a');

      expect(guard.getOwner('theme')).toBeUndefined();
      expect(guard.getOwner('lang')).toBeUndefined();
      expect(guard.getOwner('user')).toBe('app-b');
    });
  });

  describe('query methods', () => {
    it('getAll() returns the entire registry', () => {
      const guard = createNamespaceGuard();

      guard.claim('a', 'app-1');
      guard.claim('b', 'app-2');

      const all = guard.getAll();

      expect(all.size).toBe(2);
      expect(all.get('a')?.owner).toBe('app-1');
      expect(all.get('b')?.owner).toBe('app-2');
    });

    it('getOwnedBy() returns the list of keys owned by a specific app', () => {
      const guard = createNamespaceGuard();

      guard.claim('x', 'app-a');
      guard.claim('y', 'app-a');
      guard.claim('z', 'app-b');

      expect(guard.getOwnedBy('app-a')).toStrictEqual(['x', 'y']);
      expect(guard.getOwnedBy('app-b')).toStrictEqual(['z']);
      expect(guard.getOwnedBy('app-c')).toStrictEqual([]);
    });

    it('returns undefined for the owner of an unregistered key', () => {
      const guard = createNamespaceGuard();

      expect(guard.getOwner('nonexistent')).toBeUndefined();
    });
  });
});
