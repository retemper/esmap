import { describe, it, expect, vi } from 'vitest';
import { createNamespaceGuard } from './namespace-guard.js';

describe('createNamespaceGuard', () => {
  describe('claim — 키 등록', () => {
    it('미등록 키를 등록하면 성공한다', () => {
      const guard = createNamespaceGuard();

      expect(guard.claim('theme', 'app-a')).toBe(true);
      expect(guard.getOwner('theme')).toBe('app-a');
    });

    it('같은 소유자가 같은 키를 재등록하면 성공한다', () => {
      const guard = createNamespaceGuard();

      guard.claim('theme', 'app-a');

      expect(guard.claim('theme', 'app-a')).toBe(true);
    });

    it('다른 소유자가 같은 키를 등록하면 warn 모드에서 false를 반환한다', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const guard = createNamespaceGuard({ onConflict: 'warn' });

      guard.claim('theme', 'app-a');
      const result = guard.claim('theme', 'app-b');

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('네임스페이스 충돌'),
      );

      warnSpy.mockRestore();
    });

    it('다른 소유자가 같은 키를 등록하면 error 모드에서 throw한다', () => {
      const guard = createNamespaceGuard({ onConflict: 'error' });

      guard.claim('theme', 'app-a');

      expect(() => guard.claim('theme', 'app-b')).toThrow('네임스페이스 충돌');
    });

    it('다른 소유자가 같은 키를 등록하면 skip 모드에서 silent false를 반환한다', () => {
      const guard = createNamespaceGuard({ onConflict: 'skip' });

      guard.claim('theme', 'app-a');
      const result = guard.claim('theme', 'app-b');

      expect(result).toBe(false);
    });
  });

  describe('allowedSharedKeys — 공유 허용 키', () => {
    it('공유 허용 키는 여러 앱이 등록해도 충돌하지 않는다', () => {
      const guard = createNamespaceGuard({
        onConflict: 'error',
        allowedSharedKeys: ['locale', 'auth-token'],
      });

      expect(guard.claim('locale', 'app-a')).toBe(true);
      expect(guard.claim('locale', 'app-b')).toBe(true);
    });

    it('공유 허용 키의 소유자는 최초 등록자로 유지된다', () => {
      const guard = createNamespaceGuard({
        allowedSharedKeys: ['locale'],
      });

      guard.claim('locale', 'app-a');
      guard.claim('locale', 'app-b');

      expect(guard.getOwner('locale')).toBe('app-a');
    });
  });

  describe('release — 키 해제', () => {
    it('소유자가 자신의 키를 해제할 수 있다', () => {
      const guard = createNamespaceGuard();

      guard.claim('theme', 'app-a');
      guard.release('theme', 'app-a');

      expect(guard.getOwner('theme')).toBeUndefined();
    });

    it('다른 소유자의 키를 해제할 수 없다', () => {
      const guard = createNamespaceGuard();

      guard.claim('theme', 'app-a');
      guard.release('theme', 'app-b');

      expect(guard.getOwner('theme')).toBe('app-a');
    });

    it('해제 후 다른 앱이 같은 키를 등록할 수 있다', () => {
      const guard = createNamespaceGuard({ onConflict: 'error' });

      guard.claim('theme', 'app-a');
      guard.release('theme', 'app-a');

      expect(guard.claim('theme', 'app-b')).toBe(true);
      expect(guard.getOwner('theme')).toBe('app-b');
    });
  });

  describe('releaseAll — 앱별 일괄 해제', () => {
    it('특정 앱이 소유한 모든 키를 해제한다', () => {
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

  describe('조회 메서드', () => {
    it('getAll()이 전체 레지스트리를 반환한다', () => {
      const guard = createNamespaceGuard();

      guard.claim('a', 'app-1');
      guard.claim('b', 'app-2');

      const all = guard.getAll();

      expect(all.size).toBe(2);
      expect(all.get('a')?.owner).toBe('app-1');
      expect(all.get('b')?.owner).toBe('app-2');
    });

    it('getOwnedBy()가 특정 앱의 키 목록을 반환한다', () => {
      const guard = createNamespaceGuard();

      guard.claim('x', 'app-a');
      guard.claim('y', 'app-a');
      guard.claim('z', 'app-b');

      expect(guard.getOwnedBy('app-a')).toStrictEqual(['x', 'y']);
      expect(guard.getOwnedBy('app-b')).toStrictEqual(['z']);
      expect(guard.getOwnedBy('app-c')).toStrictEqual([]);
    });

    it('미등록 키의 소유자는 undefined다', () => {
      const guard = createNamespaceGuard();

      expect(guard.getOwner('nonexistent')).toBeUndefined();
    });
  });
});
