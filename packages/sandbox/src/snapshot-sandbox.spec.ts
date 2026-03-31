import { describe, it, expect, afterEach } from 'vitest';
import { createSnapshotSandbox } from './snapshot-sandbox';

describe('createSnapshotSandbox', () => {
  const TEST_PROP = '__snapshot_test_prop__';
  const windowRecord = window as unknown as Record<string, unknown>;

  afterEach(() => {
    delete windowRecord[TEST_PROP];
    delete windowRecord.__snap_a__;
    delete windowRecord.__snap_b__;
  });

  describe('activate / deactivate cycle', () => {
    it('window properties modified during activation are restored to original values on deactivation', () => {
      const sandbox = createSnapshotSandbox('test');

      sandbox.activate();
      windowRecord[TEST_PROP] = 'modified';
      expect(windowRecord[TEST_PROP]).toStrictEqual('modified');

      sandbox.deactivate();
      expect(windowRecord[TEST_PROP]).toStrictEqual(undefined);
    });

    it('newly added properties during activation are removed on deactivation', () => {
      const sandbox = createSnapshotSandbox('test');

      sandbox.activate();
      windowRecord[TEST_PROP] = 'new-prop';

      sandbox.deactivate();
      expect(Object.prototype.hasOwnProperty.call(window, TEST_PROP)).toStrictEqual(false);
    });

    it('reapplies previous changes on reactivation', () => {
      const sandbox = createSnapshotSandbox('test');

      sandbox.activate();
      windowRecord[TEST_PROP] = 'persisted';
      sandbox.deactivate();

      expect(windowRecord[TEST_PROP]).toStrictEqual(undefined);

      sandbox.activate();
      expect(windowRecord[TEST_PROP]).toStrictEqual('persisted');

      sandbox.deactivate();
    });
  });

  describe('state management', () => {
    it('isActive correctly returns the current state', () => {
      const sandbox = createSnapshotSandbox('test');

      expect(sandbox.isActive()).toStrictEqual(false);

      sandbox.activate();
      expect(sandbox.isActive()).toStrictEqual(true);

      sandbox.deactivate();
      expect(sandbox.isActive()).toStrictEqual(false);
    });

    it('does not execute redundantly when activate is called while already active', () => {
      const sandbox = createSnapshotSandbox('test');

      sandbox.activate();
      windowRecord[TEST_PROP] = 'first';

      sandbox.activate();
      expect(windowRecord[TEST_PROP]).toStrictEqual('first');

      sandbox.deactivate();
    });

    it('does not throw when deactivate is called while already inactive', () => {
      const sandbox = createSnapshotSandbox('test');

      expect(() => {
        sandbox.deactivate();
      }).not.toThrow();
    });
  });

  describe('multiple sandboxes', () => {
    it('multiple sandboxes operate sequentially', () => {
      const sandbox1 = createSnapshotSandbox('sb1');
      const sandbox2 = createSnapshotSandbox('sb2');

      sandbox1.activate();
      windowRecord.__snap_a__ = 'from-sb1';
      sandbox1.deactivate();

      expect(windowRecord.__snap_a__).toStrictEqual(undefined);

      sandbox2.activate();
      windowRecord.__snap_b__ = 'from-sb2';
      sandbox2.deactivate();

      expect(windowRecord.__snap_b__).toStrictEqual(undefined);

      sandbox1.activate();
      expect(windowRecord.__snap_a__).toStrictEqual('from-sb1');
      expect(windowRecord.__snap_b__).toStrictEqual(undefined);
      sandbox1.deactivate();
    });

    it('sets the name property correctly', () => {
      const sandbox = createSnapshotSandbox('my-sandbox');
      expect(sandbox.name).toStrictEqual('my-sandbox');
    });
  });
});
