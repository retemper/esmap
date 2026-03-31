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

  it('registers the API on window.__ESMAP__', () => {
    installDevtoolsApi();

    const win = globalThis as Record<string, unknown>;
    expect(win.__ESMAP__).toBeDefined();
  });

  it('does not overwrite if already registered', () => {
    const win = globalThis as Record<string, unknown>;
    const existing = { marker: true };
    win.__ESMAP__ = existing;

    installDevtoolsApi();

    expect(win.__ESMAP__).toBe(existing);
  });

  describe('API methods', () => {
    /** Retrieves the devtools API instance. */
    function getApi(): EsmapDevtoolsApi {
      installDevtoolsApi();
      const win = globalThis as Record<string, unknown>;
      return win.__ESMAP__ as EsmapDevtoolsApi;
    }

    it('overrides() prints the override list to the console', () => {
      const api = getApi();
      const consoleSpy = vi.spyOn(console, 'log');

      api.overrides();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active overrides'));

      consoleSpy.mockRestore();
    });

    it('overrides() prints as a group when active overrides exist', () => {
      setOverride('react', 'http://localhost/react.js');

      const api = getApi();
      const groupSpy = vi.spyOn(console, 'group');
      const logSpy = vi.spyOn(console, 'log');
      const groupEndSpy = vi.spyOn(console, 'groupEnd');

      api.overrides();

      expect(groupSpy).toHaveBeenCalledWith(expect.stringContaining('(1)'));
      expect(logSpy).toHaveBeenCalledWith('react → http://localhost/react.js');
      expect(groupEndSpy).toHaveBeenCalled();

      groupSpy.mockRestore();
      logSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('override() adds a new override', () => {
      const api = getApi();
      const consoleSpy = vi.spyOn(console, 'log');

      api.override('react', 'http://localhost/react.js');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Override set'));
      expect(api.isOverriding()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('removeOverride() removes an override', () => {
      const api = getApi();
      setOverride('react', 'http://localhost/react.js');

      api.removeOverride('react');
      expect(api.isOverriding()).toBe(false);
    });

    it('clearOverrides() removes all overrides', () => {
      const api = getApi();
      setOverride('react', 'http://localhost/react.js');
      setOverride('vue', 'http://localhost/vue.js');

      api.clearOverrides();
      expect(api.isOverriding()).toBe(false);
    });

    it('isOverriding() returns whether overrides are active', () => {
      const api = getApi();

      expect(api.isOverriding()).toBe(false);

      setOverride('react', 'http://localhost/react.js');
      expect(api.isOverriding()).toBe(true);

      clearOverrides();
      expect(api.isOverriding()).toBe(false);
    });
  });
});
