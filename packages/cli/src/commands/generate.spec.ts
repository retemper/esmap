import { describe, it, expect, vi } from 'vitest';
import { parseGenerateFlags, generate } from './generate.js';
import type { GenerateOptions } from './generate.js';
import { resolve, dirname } from 'node:path';

describe('generate command', () => {
  describe('parseGenerateFlags', () => {
    it('uses default value when config flag is missing', () => {
      const result = parseGenerateFlags({});

      expect(result).toStrictEqual({
        config: 'esmap.config.json',
        out: undefined,
      });
    });

    it('parses config and out flags', () => {
      const result = parseGenerateFlags({
        config: './my-config.json',
        out: './dist/importmap.json',
      });

      expect(result).toStrictEqual({
        config: './my-config.json',
        out: './dist/importmap.json',
      });
    });
  });

  describe('generate', () => {
    /** Test config file content */
    const testConfig = JSON.stringify({
      apps: {
        '@flex/checkout': { path: 'apps/checkout' },
      },
      shared: {
        react: { global: true, url: 'https://esm.sh/react@18' },
      },
      cdnBase: 'https://cdn.flex.team',
    });

    /** Test manifest file content */
    const testManifest = JSON.stringify({
      name: '@flex/checkout',
      version: '1.0.0',
      entry: 'checkout-abc123.js',
      assets: ['checkout-abc123.js'],
      dependencies: { shared: ['react'], internal: [] },
      modulepreload: ['checkout-abc123.js'],
    });

    it('reads config and manifests to generate import map JSON', async () => {
      const configPath = resolve('/tmp/esmap.config.json');
      const basePath = dirname(configPath);
      const manifestPath = resolve(basePath, 'apps/checkout/manifest.json');

      const mockReadFile = vi.fn().mockImplementation((path: string) => {
        if (path === configPath) return Promise.resolve(testConfig);
        if (path === manifestPath) return Promise.resolve(testManifest);
        return Promise.reject(new Error(`File not found: ${path}`));
      });
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await generate(
        { config: configPath },
        mockReadFile as never,
        mockWriteFile as never,
      );

      const parsed = JSON.parse(result);
      expect(parsed.imports['@flex/checkout']).toBe(
        'https://cdn.flex.team/apps/checkout/checkout-abc123.js',
      );
      expect(parsed.imports['react']).toBe('https://esm.sh/react@18');

      consoleSpy.mockRestore();
    });

    it('writes to a file when --out option is provided', async () => {
      const configPath = resolve('/tmp/esmap.config.json');

      const mockReadFile = vi.fn().mockImplementation((path: string) => {
        if (path === configPath) {
          return Promise.resolve(
            JSON.stringify({
              apps: {},
              shared: { react: { url: 'https://esm.sh/react' } },
            }),
          );
        }
        return Promise.reject(new Error(`File not found: ${path}`));
      });
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await generate(
        { config: configPath, out: '/tmp/output.json' },
        mockReadFile as never,
        mockWriteFile as never,
      );

      expect(mockWriteFile).toHaveBeenCalledWith(
        resolve('/tmp/output.json'),
        expect.any(String),
        'utf-8',
      );

      consoleSpy.mockRestore();
    });

    it('throws an error when the config file is invalid', async () => {
      const configPath = resolve('/tmp/invalid.json');

      const mockReadFile = vi.fn().mockResolvedValue('null');
      const mockWriteFile = vi.fn();

      await expect(
        generate({ config: configPath }, mockReadFile as never, mockWriteFile as never),
      ).rejects.toThrow('Invalid config file');
    });

    it('skips apps without manifests and generates the rest', async () => {
      const configPath = resolve('/tmp/esmap.config.json');

      const mockReadFile = vi.fn().mockImplementation((path: string) => {
        if (path === configPath) {
          return Promise.resolve(
            JSON.stringify({
              apps: { '@flex/missing': { path: 'apps/missing' } },
              shared: {},
            }),
          );
        }
        return Promise.reject(new Error('Not found'));
      });
      const mockWriteFile = vi.fn();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await generate(
        { config: configPath },
        mockReadFile as never,
        mockWriteFile as never,
      );

      const parsed = JSON.parse(result);
      expect(parsed.imports['@flex/missing']).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });
});
