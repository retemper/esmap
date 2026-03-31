import { describe, it, expect, vi } from 'vitest';
import { status, parseStatusFlags, formatStatus } from './status.js';
import type { StatusResult } from './status.js';

/** Creates a mock fetch that returns a successful response. */
function createMockFetch(responseBody: unknown, statusCode = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

describe('status command', () => {
  describe('parseStatusFlags', () => {
    it('parses the server flag', () => {
      const result = parseStatusFlags({ server: 'http://localhost:3000' });

      expect(result).toStrictEqual({ server: 'http://localhost:3000' });
    });

    it('throws an error when server flag is missing', () => {
      expect(() => parseStatusFlags({})).toThrow('Missing required flag --server');
    });
  });

  describe('status', () => {
    it('sends the correct request to GET /', async () => {
      const mockFetch = createMockFetch({ imports: {} });

      await status({ server: 'http://localhost:3000' }, mockFetch);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    });

    it('returns the import map from the server response', async () => {
      const importMap = {
        imports: {
          '@flex/checkout': 'https://cdn/checkout.js',
          react: 'https://esm.sh/react@18',
        },
      };
      const mockFetch = createMockFetch(importMap);

      const result = await status({ server: 'http://localhost:3000' }, mockFetch);

      expect(result).toStrictEqual(importMap);
    });

    it('also returns import maps that include scopes', async () => {
      const importMap = {
        imports: { react: 'https://esm.sh/react@18' },
        scopes: { '/app/': { lodash: 'https://esm.sh/lodash@4' } },
      };
      const mockFetch = createMockFetch(importMap);

      const result = await status({ server: 'http://localhost:3000' }, mockFetch);

      expect(result.scopes).toStrictEqual({ '/app/': { lodash: 'https://esm.sh/lodash@4' } });
    });

    it('throws an exception when the server returns an error', async () => {
      const mockFetch = createMockFetch('Internal error', 500);

      await expect(status({ server: 'http://localhost:3000' }, mockFetch)).rejects.toThrow(
        'Status check failed (500)',
      );
    });

    it('throws an exception for an invalid response', async () => {
      const mockFetch = createMockFetch({ notAnImportMap: true });

      await expect(status({ server: 'http://localhost:3000' }, mockFetch)).rejects.toThrow(
        'Invalid import map response',
      );
    });

    it('strips trailing slash from the server URL', async () => {
      const mockFetch = createMockFetch({ imports: {} });

      await status({ server: 'http://localhost:3000/' }, mockFetch);

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:3000/');
    });
  });

  describe('formatStatus', () => {
    it('displays imports entries sorted', () => {
      const result: StatusResult = {
        imports: {
          react: 'https://esm.sh/react@18',
          '@flex/checkout': 'https://cdn/checkout.js',
        },
      };

      const output = formatStatus(result);

      expect(output).toContain('=== Current Import Map ===');
      expect(output).toContain('@flex/checkout');
      expect(output).toContain('react');
      expect(output).toContain('https://cdn/checkout.js');
      expect(output).toContain('https://esm.sh/react@18');
    });

    it('shows a notice message when imports is empty', () => {
      const result: StatusResult = { imports: {} };

      const output = formatStatus(result);

      expect(output).toContain('(no imports registered)');
    });

    it('displays scopes when present', () => {
      const result: StatusResult = {
        imports: { react: 'https://esm.sh/react@18' },
        scopes: { '/app/': { lodash: 'https://esm.sh/lodash@4' } },
      };

      const output = formatStatus(result);

      expect(output).toContain('--- Scopes ---');
      expect(output).toContain('/app/');
      expect(output).toContain('lodash');
    });

    it('sorts specifiers alphabetically', () => {
      const result: StatusResult = {
        imports: {
          'z-lib': 'https://cdn/z.js',
          'a-lib': 'https://cdn/a.js',
          'm-lib': 'https://cdn/m.js',
        },
      };

      const output = formatStatus(result);
      const lines = output.split('\n').filter((line) => line.includes('→'));
      const specifiers = lines.map((line) => line.trim().split(/\s+/)[0]);

      expect(specifiers).toStrictEqual(['a-lib', 'm-lib', 'z-lib']);
    });
  });
});
