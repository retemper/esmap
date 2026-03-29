import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installDevtoolsApi } from './console-api.js';
import type { EsmapDevtoolsApi } from './console-api.js';
import { clearOverrides, setOverride } from './overrides.js';

describe('installDevtoolsApi', () => {
  beforeEach(() => {
    localStorage.clear();
    const win = globalThis as Record<string, unknown>;
    delete win.__ESMAP__;
  });

  it('window.__ESMAP__에 API를 등록한다', () => {
    installDevtoolsApi();

    const win = globalThis as Record<string, unknown>;
    expect(win.__ESMAP__).toBeDefined();
  });

  it('이미 등록되어 있으면 덮어쓰지 않는다', () => {
    const win = globalThis as Record<string, unknown>;
    const existing = { marker: true };
    win.__ESMAP__ = existing;

    installDevtoolsApi();

    expect(win.__ESMAP__).toBe(existing);
  });

  describe('API 메서드', () => {
    /** devtools API 인스턴스를 가져온다. */
    function getApi(): EsmapDevtoolsApi {
      installDevtoolsApi();
      const win = globalThis as Record<string, unknown>;
      return win.__ESMAP__ as EsmapDevtoolsApi;
    }

    it('overrides()는 콘솔에 override 목록을 출력한다', () => {
      const api = getApi();
      const consoleSpy = vi.spyOn(console, 'log');

      api.overrides();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('override 없음'));

      consoleSpy.mockRestore();
    });

    it('overrides()는 활성 override가 있으면 그룹으로 출력한다', () => {
      setOverride('react', 'http://localhost/react.js');

      const api = getApi();
      const groupSpy = vi.spyOn(console, 'group');
      const logSpy = vi.spyOn(console, 'log');
      const groupEndSpy = vi.spyOn(console, 'groupEnd');

      api.overrides();

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('1개'));
      expect(logSpy).toHaveBeenCalledWith('react → http://localhost/react.js');
      expect(groupEndSpy).toHaveBeenCalled();

      groupSpy.mockRestore();
      logSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('override()로 새 override를 추가한다', () => {
      const api = getApi();
      const consoleSpy = vi.spyOn(console, 'log');

      api.override('react', 'http://localhost/react.js');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('override 설정'));
      expect(api.isOverriding()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('removeOverride()로 override를 해제한다', () => {
      const api = getApi();
      setOverride('react', 'http://localhost/react.js');

      api.removeOverride('react');
      expect(api.isOverriding()).toBe(false);
    });

    it('clearOverrides()로 모든 override를 해제한다', () => {
      const api = getApi();
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      api.clearOverrides();
      expect(api.isOverriding()).toBe(false);
    });

    it('isOverriding()은 override 유무를 반환한다', () => {
      const api = getApi();

      expect(api.isOverriding()).toBe(false);

      setOverride('react', 'http://localhost/react.js');
      expect(api.isOverriding()).toBe(true);

      clearOverrides();
      expect(api.isOverriding()).toBe(false);
    });
  });
});
