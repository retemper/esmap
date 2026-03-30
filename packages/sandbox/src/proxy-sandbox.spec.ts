import { describe, it, expect } from 'vitest';
import { ProxySandbox, DEFAULT_ALLOW_LIST } from './proxy-sandbox';

describe('ProxySandbox', () => {
  describe('property isolation', () => {
    it('setting properties in the sandbox does not affect the real window', () => {
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

    it('ignores property assignments when inactive', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      const proxy = sandbox.proxy as unknown as Record<string, unknown>;

      proxy.__test_inactive__ = 'should-be-ignored';

      expect(proxy.__test_inactive__).toStrictEqual(undefined);
      expect(sandbox.getModifiedProps()).toStrictEqual([]);
    });

    it('multiple sandboxes operate independently', () => {
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
    it('reads allowList properties directly from the real window', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      expect(sandbox.proxy.document).toStrictEqual(window.document);
      expect(Reflect.get(sandbox.proxy, 'console')).toStrictEqual(console);

      sandbox.deactivate();
    });

    it('applies the default allowList', () => {
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

    it('allows setting a custom allowList', () => {
      const sandbox = new ProxySandbox({
        name: 'custom',
        allowList: ['document'],
      });
      sandbox.activate();

      expect(sandbox.proxy.document).toStrictEqual(window.document);

      sandbox.deactivate();
    });
  });

  describe('modification tracking', () => {
    it('returns the list of modified properties after deactivation', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__prop_a__ = 1;
      proxy.__prop_b__ = 2;

      sandbox.deactivate();

      expect(sandbox.getModifiedProps()).toStrictEqual(['__prop_a__', '__prop_b__']);
    });

    it('restores previous modifications on reactivation', () => {
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

  describe('delete operation', () => {
    it('delete operates only on the internal map', () => {
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

  describe('has operation', () => {
    it('has checks both the internal map and window', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__has_test__ = true;

      expect('__has_test__' in proxy).toStrictEqual(true);
      expect('document' in proxy).toStrictEqual(true);
      expect('__nonexistent_xyz__' in proxy).toStrictEqual(false);

      sandbox.deactivate();
    });

    it('returns false for deleted properties in has', () => {
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
    it('includes modified properties in ownKeys', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__ownkeys_test__ = 'value';

      const keys = Object.getOwnPropertyNames(proxy);
      expect(keys).toContain('__ownkeys_test__');

      sandbox.deactivate();
    });

    it('excludes deleted properties from ownKeys', () => {
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
    it('returns the descriptor of modified properties', () => {
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

    it('returns undefined for the descriptor of deleted properties', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const proxy = sandbox.proxy as unknown as Record<string, unknown>;
      proxy.__desc_del__ = 'value';
      delete proxy.__desc_del__;

      const descriptor = Object.getOwnPropertyDescriptor(proxy, '__desc_del__');
      expect(descriptor).toStrictEqual(undefined);

      sandbox.deactivate();
    });

    it('returns existing window property descriptors as configurable', () => {
      const sandbox = new ProxySandbox({ name: 'test' });
      sandbox.activate();

      const descriptor = Object.getOwnPropertyDescriptor(sandbox.proxy, 'document');
      expect(descriptor).toBeDefined();
      expect(descriptor?.configurable).toStrictEqual(true);

      sandbox.deactivate();
    });
  });

  describe('defineProperty trap', () => {
    it('can define properties via defineProperty when active', () => {
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

    it('ignores defineProperty when inactive', () => {
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
