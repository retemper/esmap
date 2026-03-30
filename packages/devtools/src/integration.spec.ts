import { describe, it, expect, beforeEach } from 'vitest';
import { setOverride, clearOverrides, applyOverrides, hasActiveOverrides } from './overrides.js';
import { installDevtoolsApi } from './console-api.js';
import type { ImportMap } from '@esmap/shared';

/**
 * Integration tests for devtools overrides and import map application.
 * Simulates real developer workflows.
 */
describe('devtools integration tests', () => {
  beforeEach(() => {
    localStorage.clear();
    const win = globalThis as Record<string, unknown>;
    delete win.__ESMAP__;
  });

  it('full workflow: set override -> apply import map -> clear override', () => {
    const productionMap: ImportMap = {
      imports: {
        '@flex/checkout': 'https://cdn.flex.team/checkout-abc123.js',
        '@flex/people': 'https://cdn.flex.team/people-def456.js',
        react: 'https://cdn.flex.team/shared/react.js',
      },
    };

    // 1. State with no overrides
    expect(hasActiveOverrides()).toBe(false);
    const noOverride = applyOverrides(productionMap);
    expect(noOverride).toBe(productionMap); // same reference

    // 2. Developer overrides checkout with a local build
    setOverride('@flex/checkout', 'http://localhost:5173/checkout.js');
    expect(hasActiveOverrides()).toBe(true);

    const overridden = applyOverrides(productionMap);
    expect(overridden.imports['@flex/checkout']).toBe('http://localhost:5173/checkout.js');
    expect(overridden.imports['@flex/people']).toBe('https://cdn.flex.team/people-def456.js');
    expect(overridden.imports.react).toBe('https://cdn.flex.team/shared/react.js');

    // Original is not modified
    expect(productionMap.imports['@flex/checkout']).toBe(
      'https://cdn.flex.team/checkout-abc123.js',
    );

    // 3. Clear overrides after testing
    clearOverrides();
    expect(hasActiveOverrides()).toBe(false);
    const afterClear = applyOverrides(productionMap);
    expect(afterClear).toBe(productionMap);
  });

  it('manages overrides through the devtools API', () => {
    installDevtoolsApi();
    const win = globalThis as Record<string, unknown>;
    const api = win.__ESMAP__ as {
      override: (s: string, u: string) => void;
      isOverriding: () => boolean;
      clearOverrides: () => void;
    };

    // Override via API
    api.override('@flex/checkout', 'http://localhost:5173/checkout.js');
    expect(api.isOverriding()).toBe(true);

    // Apply to import map
    const map: ImportMap = {
      imports: { '@flex/checkout': 'https://cdn/checkout.js' },
    };
    const result = applyOverrides(map);
    expect(result.imports['@flex/checkout']).toBe('http://localhost:5173/checkout.js');

    // Clear
    api.clearOverrides();
    expect(api.isOverriding()).toBe(false);
  });

  it('page reload simulation -- restores overrides from localStorage', () => {
    // Override set in a "previous session"
    setOverride('@flex/checkout', 'http://localhost:5173/checkout.js');

    // Automatically read from localStorage at the start of a "new session"
    // (persisted because clearOverrides was not called)
    expect(hasActiveOverrides()).toBe(true);

    const map: ImportMap = {
      imports: { '@flex/checkout': 'https://cdn/checkout.js' },
    };
    const result = applyOverrides(map);
    expect(result.imports['@flex/checkout']).toBe('http://localhost:5173/checkout.js');
  });
});
