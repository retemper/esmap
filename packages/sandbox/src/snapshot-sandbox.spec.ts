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

  describe('activate / deactivate 사이클', () => {
    it('활성화 중 변경한 window 속성이 비활성화 시 원래 값으로 복원된다', () => {
      const sandbox = createSnapshotSandbox('test');

      sandbox.activate();
      windowRecord[TEST_PROP] = 'modified';
      expect(windowRecord[TEST_PROP]).toStrictEqual('modified');

      sandbox.deactivate();
      expect(windowRecord[TEST_PROP]).toStrictEqual(undefined);
    });

    it('활성화 중 새로 추가된 속성이 비활성화 시 제거된다', () => {
      const sandbox = createSnapshotSandbox('test');

      sandbox.activate();
      windowRecord[TEST_PROP] = 'new-prop';

      sandbox.deactivate();
      expect(Object.prototype.hasOwnProperty.call(window, TEST_PROP)).toStrictEqual(false);
    });

    it('재활성화 시 이전 변경사항이 다시 적용된다', () => {
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

  describe('상태 관리', () => {
    it('isActive가 현재 상태를 올바르게 반환한다', () => {
      const sandbox = createSnapshotSandbox('test');

      expect(sandbox.isActive()).toStrictEqual(false);

      sandbox.activate();
      expect(sandbox.isActive()).toStrictEqual(true);

      sandbox.deactivate();
      expect(sandbox.isActive()).toStrictEqual(false);
    });

    it('이미 활성화된 상태에서 activate를 호출해도 중복 실행되지 않는다', () => {
      const sandbox = createSnapshotSandbox('test');

      sandbox.activate();
      windowRecord[TEST_PROP] = 'first';

      sandbox.activate();
      expect(windowRecord[TEST_PROP]).toStrictEqual('first');

      sandbox.deactivate();
    });

    it('이미 비활성화된 상태에서 deactivate를 호출해도 에러가 발생하지 않는다', () => {
      const sandbox = createSnapshotSandbox('test');

      expect(() => {
        sandbox.deactivate();
      }).not.toThrow();
    });
  });

  describe('다중 샌드박스', () => {
    it('여러 샌드박스가 순차적으로 동작한다', () => {
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

    it('name 속성이 올바르게 설정된다', () => {
      const sandbox = createSnapshotSandbox('my-sandbox');
      expect(sandbox.name).toStrictEqual('my-sandbox');
    });
  });
});
