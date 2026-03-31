import { describe, it, expect, vi } from 'vitest';
import { deploy, parseDeployFlags, resolveUrlFromManifest } from './deploy.js';
import type { DeployOptions } from './deploy.js';

/** Creates a mock fetch that returns a successful response. */
function createMockFetch(responseBody: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

describe('deploy command', () => {
  describe('parseDeployFlags', () => {
    it('parses required flags correctly', () => {
      const flags = {
        server: 'http://localhost:3000',
        name: '@flex/checkout',
        url: 'https://cdn.flex.team/checkout.js',
      };

      const result = parseDeployFlags(flags);

      expect(result).toStrictEqual({
        server: 'http://localhost:3000',
        name: '@flex/checkout',
        url: 'https://cdn.flex.team/checkout.js',
        deployedBy: undefined,
        manifest: undefined,
        cdnBase: undefined,
      });
    });

    it('parses optional flags as well', () => {
      const flags = {
        server: 'http://localhost:3000',
        name: '@flex/checkout',
        url: 'https://cdn.flex.team/checkout.js',
        'deployed-by': 'ci-bot',
        manifest: './dist/manifest.json',
        'cdn-base': 'https://cdn.flex.team',
      };

      const result = parseDeployFlags(flags);

      expect(result.deployedBy).toBe('ci-bot');
      expect(result.manifest).toBe('./dist/manifest.json');
      expect(result.cdnBase).toBe('https://cdn.flex.team');
    });

    it('throws an error when required flags are missing', () => {
      expect(() => parseDeployFlags({ service: 'app', url: 'http://x' })).toThrow(
        'Missing required flag --server',
      );
      expect(() => parseDeployFlags({ server: 'http://x', url: 'http://x' })).toThrow(
        'Missing required flag --name',
      );
      expect(() => parseDeployFlags({ server: 'http://x', name: 'app' })).toThrow(
        'Missing required flag --url',
      );
    });
  });

  describe('deploy', () => {
    it('sends the correct request to PATCH /services/:name', async () => {
      const mockFetch = createMockFetch({ service: '@flex/checkout', url: 'https://cdn/app.js' });

      const options: DeployOptions = {
        server: 'http://localhost:3000',
        name: '@flex/checkout',
        url: 'https://cdn/app.js',
      };

      await deploy(options, mockFetch);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/services/%40flex%2Fcheckout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn/app.js' }),
      });
    });

    it('includes deployedBy in the request body when provided', async () => {
      const mockFetch = createMockFetch({ service: 'app', url: 'http://x' });

      await deploy(
        { server: 'http://localhost:3000', name: 'app', url: 'http://x', deployedBy: 'ci' },
        mockFetch,
      );

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.deployedBy).toBe('ci');
    });

    it('extracts name and url from the server response and returns the result', async () => {
      const mockFetch = createMockFetch({
        service: '@flex/checkout',
        url: 'https://cdn/checkout-abc.js',
      });

      const result = await deploy(
        {
          server: 'http://localhost:3000',
          name: '@flex/checkout',
          url: 'https://cdn/checkout-abc.js',
        },
        mockFetch,
      );

      expect(result).toStrictEqual({
        name: '@flex/checkout',
        url: 'https://cdn/checkout-abc.js',
        success: true,
      });
    });

    it('throws an exception when the server returns an error', async () => {
      const mockFetch = createMockFetch('Not found', 404);

      await expect(
        deploy({ server: 'http://localhost:3000', name: 'app', url: 'http://x' }, mockFetch),
      ).rejects.toThrow('Deploy failed (404)');
    });

    it('strips trailing slash from the server URL', async () => {
      const mockFetch = createMockFetch({ service: 'app', url: 'http://x' });

      await deploy({ server: 'http://localhost:3000/', name: 'app', url: 'http://x' }, mockFetch);

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:3000/services/app');
    });

    it('falls back to option values when the response body has an unexpected shape', async () => {
      const mockFetch = createMockFetch({ ok: true });

      const result = await deploy(
        { server: 'http://localhost:3000', name: 'app', url: 'http://x' },
        mockFetch,
      );

      expect(result).toStrictEqual({
        name: 'app',
        url: 'http://x',
        success: true,
      });
    });
  });

  describe('resolveUrlFromManifest', () => {
    it('is defined as a function', () => {
      expect(typeof resolveUrlFromManifest).toBe('function');
    });
  });
});
