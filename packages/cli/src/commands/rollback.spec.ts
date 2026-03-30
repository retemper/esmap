import { describe, it, expect, vi } from 'vitest';
import { rollback, parseRollbackFlags } from './rollback.js';
import type { RollbackOptions } from './rollback.js';

/** Creates a mock fetch that returns a successful response. */
function createMockFetch(responseBody: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

describe('rollback command', () => {
  describe('parseRollbackFlags', () => {
    it('parses required flags correctly', () => {
      const result = parseRollbackFlags({
        server: 'http://localhost:3000',
        name: '@flex/checkout',
      });

      expect(result).toStrictEqual({
        server: 'http://localhost:3000',
        name: '@flex/checkout',
      });
    });

    it('throws an error when server flag is missing', () => {
      expect(() => parseRollbackFlags({ name: 'app' })).toThrow('Missing required flag --server');
    });

    it('throws an error when name flag is missing', () => {
      expect(() => parseRollbackFlags({ server: 'http://x' })).toThrow(
        'Missing required flag --name',
      );
    });
  });

  describe('rollback', () => {
    it('sends the correct request to POST /rollback/:name', async () => {
      const mockFetch = createMockFetch({
        service: '@flex/checkout',
        rolledBackTo: 'https://cdn/checkout-prev.js',
      });

      const options: RollbackOptions = {
        server: 'http://localhost:3000',
        name: '@flex/checkout',
      };

      await rollback(options, mockFetch);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/rollback/%40flex%2Fcheckout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('extracts name and url from the server response and returns the result', async () => {
      const mockFetch = createMockFetch({
        service: '@flex/checkout',
        rolledBackTo: 'https://cdn/checkout-prev.js',
      });

      const result = await rollback(
        { server: 'http://localhost:3000', name: '@flex/checkout' },
        mockFetch,
      );

      expect(result).toStrictEqual({
        name: '@flex/checkout',
        url: 'https://cdn/checkout-prev.js',
        success: true,
      });
    });

    it('throws an exception when the server returns an error', async () => {
      const mockFetch = createMockFetch('Service not found', 404);

      await expect(
        rollback({ server: 'http://localhost:3000', name: 'unknown' }, mockFetch),
      ).rejects.toThrow('Rollback failed (404)');
    });

    it('strips trailing slash from the server URL', async () => {
      const mockFetch = createMockFetch({ service: 'app', rolledBackTo: 'http://x' });

      await rollback({ server: 'http://localhost:3000/', name: 'app' }, mockFetch);

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:3000/rollback/app');
    });

    it('throws an error when the response body has an unexpected shape', async () => {
      const mockFetch = createMockFetch({ status: 'ok' });

      await expect(
        rollback({ server: 'http://localhost:3000', name: 'app' }, mockFetch),
      ).rejects.toThrow('Unexpected server response format');
    });
  });
});
