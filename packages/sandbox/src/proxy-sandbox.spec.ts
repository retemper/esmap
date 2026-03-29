import { describe, it, expect } from 'vitest';
import { ProxySandbox, DEFAULT_ALLOW_LIST } from './proxy-sandbox';

describe('ProxySandbox', () => {
  describe('속성 격리', () => {
    it('샌드박스 내 속성 설정이 실제 window에 영향을 주지 않는다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__test_proxy_prop__ = 'sandboxed';

      expect(proxy.__test_proxy_prop__).toStrictEqual('sandboxed');
      expect((window as unknown as Record<string, unknown>).__test_proxy_prop__).toStrictEqual(
        undefined,
      );

      sandbox.deactivate();
    });

    it('비활성 상태에서 속성 설정은 무시한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      const proxy = sandbox.proxy as unknown as Record<string, unknown>;

      proxy.__test_inactive__ = 'should-be-ignored';

      expect(proxy.__test_inactive__).toStrictEqual(undefined);
      expect(sandbox.getModifiedProps()).toStrictEqual([]);
    });

    it('여러 샌드박스가 독립적으로 동작한다', () => {
      const sandbox1 = new ProxySandbox({ name: 'sb1' });
      const sandbox2 = new ProxySandbox({ name: 'sb2' });

      sandbox1.activate();
      sandbox2.activate();

      const proxy1 = sandbox1.proxy as unknown as Record<string, unknown>;
      const proxy2 = sandbox2.proxy as unknown as Record<string, unknown>;

      proxy1.__shared_key__ = 'from-sb1';
      proxy2.__shared_key__ = 'from-sb2';

      expect(proxy1.__shared_key__).toStrictEqual('from-sb1');
      expect(proxy2.__shared_key__).toStrictEqual('from-sb2');
      expect((window as unknown as Record<string, unknown>).__shared_key__).toStrictEqual(
        undefined,
      );

      sandbox1.deactivate();
      sandbox2.deactivate();
    });
  });

  describe('allowList', () => {
    it('allowList 속성은 실제 window에서 직접 읽는다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      expect(sandbox.proxy.document).toStrictEqual(window.document);
      expect(Reflect.get(sandbox.proxy, 'console')).toStrictEqual(console);

      sandbox.deactivate();
    });

    it('기본 allowList가 적용된다', () => {
      const expected = [
        'document',
        'location',
        'history',
        'navigator',
        'console',
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'fetch',
        'performance',
      ];

      expect([...DEFAULT_ALLOW_LIST]).toStrictEqual(expected);
    });

    it('커스텀 allowList를 설정할 수 있다', () => {
      const sandbox = new ProxySandbox({
        name: 'custom',
        allowList: ['document'],
      });
      sandbox.activate();

      expect(sandbox.proxy.document).toStrictEqual(window.document);

      sandbox.deactivate();
    });
  });

  describe('수정 추적', () => {
    it('비활성화 후 수정된 속성 목록을 반환한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__prop_a__ = 1;
      proxy.__prop_b__ = 2;

      sandbox.deactivate();

      expect(sandbox.getModifiedProps()).toStrictEqual(['__prop_a__', '__prop_b__']);
    });

    it('재활성화 시 이전 수정사항을 복원한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__persist__ = 'value';

      sandbox.deactivate();

      const sandbox2 = new ProxySandbox({ name: 'other' });
      sandbox2.activate();
      const proxy2 = sandbox2.proxy as unknown as Record<string, unknown>;
      expect(proxy2.__persist__).toStrictEqual(undefined);
      sandbox2.deactivate();

      sandbox.activate();
      expect(proxy.__persist__).toStrictEqual('value');

      sandbox.deactivate();
    });
  });

  describe('delete 연산', () => {
    it('delete 연산이 내부 맵에서만 동작한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__del_test__ = 'to-delete';
      expect(proxy.__del_test__).toStrictEqual('to-delete');

      delete proxy.__del_test__;
      expect(proxy.__del_test__).toStrictEqual(undefined);
      expect(sandbox.getModifiedProps()).toStrictEqual([]);

      sandbox.deactivate();
    });
  });

  describe('has 연산', () => {
    it('has 연산이 내부 맵과 window 모두 확인한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__has_test__ = true;

      expect('__has_test__' in proxy).toStrictEqual(true);
      expect('document' in proxy).toStrictEqual(true);
      expect('__nonexistent_xyz__' in proxy).toStrictEqual(false);

      sandbox.deactivate();
    });

    it('삭제된 속성은 has에서 false를 반환한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__has_del__ = 'exists';
      expect('__has_del__' in proxy).toStrictEqual(true);

      delete proxy.__has_del__;
      expect('__has_del__' in proxy).toStrictEqual(false);

      sandbox.deactivate();
    });
  });

  describe('ownKeys trap', () => {
    it('수정된 속성이 ownKeys에 포함된다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__ownkeys_test__ = 'value';

      const keys = Object.getOwnPropertyNames(proxy);
      expect(keys).toContain('__ownkeys_test__');

      sandbox.deactivate();
    });

    it('삭제된 속성이 ownKeys에서 제외된다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__ownkeys_del__ = 'value';
      delete proxy.__ownkeys_del__;

      const keys = Object.getOwnPropertyNames(proxy);
      expect(keys).not.toContain('__ownkeys_del__');

      sandbox.deactivate();
    });
  });

  describe('getOwnPropertyDescriptor trap', () => {
    it('수정된 속성의 descriptor를 반환한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__desc_test__ = 42;

      const descriptor = Object.getOwnPropertyDescriptor(proxy, '__desc_test__');
      expect(descriptor).toStrictEqual({
        value: 42,
        writable: true,
        configurable: true,
        enumerable: true,
      });

      sandbox.deactivate();
    });

    it('삭제된 속성의 descriptor는 undefined를 반환한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__desc_del__ = 'value';
      delete proxy.__desc_del__;

      const descriptor = Object.getOwnPropertyDescriptor(proxy, '__desc_del__');
      expect(descriptor).toStrictEqual(undefined);

      sandbox.deactivate();
    });

    it('window의 기존 속성 descriptor를 configurable로 반환한다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const descriptor = Object.getOwnPropertyDescriptor(sandbox.proxy, 'document');
      expect(descriptor).toBeDefined();
      expect(descriptor?.configurable).toStrictEqual(true);

      sandbox.deactivate();
    });
  });

  describe('defineProperty trap', () => {
    it('활성 상태에서 defineProperty로 속성을 정의할 수 있다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      Object.defineProperty(sandbox.proxy, '__define_test__', {
        value: 'defined',
        writable: true,
        configurable: true,
        enumerable: true,
      });

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      expect(proxy.__define_test__).toStrictEqual('defined');
      expect(sandbox.getModifiedProps()).toContain('__define_test__');

      sandbox.deactivate();
    });

    it('비활성 상태에서 defineProperty는 무시된다', () => {
      const sandbox = new ProxySandbox({ name: 'test' });

      Object.defineProperty(sandbox.proxy, '__define_inactive__', {
        value: 'ignored',
      });

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      expect(proxy.__define_inactive__).toStrictEqual(undefined);

      sandbox.deactivate();
    });
  });
});
