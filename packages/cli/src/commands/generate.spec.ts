import { describe, it, expect, vi } from 'vitest';
import { parseGenerateFlags, generate } from './generate.js';
import type { GenerateOptions } from './generate.js';
import { resolve, dirname } from 'node:path';

describe('generate 커맨드', () => {
  describe('parseGenerateFlags', () => {
    it('config 플래그가 없으면 기본값을 사용한다', () => {
      const result = parseGenerateFlags({});

      expect(result).toStrictEqual({
        config: 'esmap.config.json',
        out: undefined,
      });
    });

    it('config과 out 플래그를 파싱한다', () => {
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
    /** 테스트용 설정 파일 내용 */
    const testConfig = JSON.stringify({
      apps: {
        '@flex/checkout': { path: 'apps/checkout' },
      },
      shared: {
        react: { global: true, url: 'https://esm.sh/react@18' },
      },
      cdnBase: 'https://cdn.flex.team',
    });

    /** 테스트용 매니페스트 파일 내용 */
    const testManifest = JSON.stringify({
      name: '@flex/checkout',
      version: '1.0.0',
      entry: 'checkout-abc123.js',
      assets: ['checkout-abc123.js'],
      dependencies: { shared: ['react'], internal: [] },
      modulepreload: ['checkout-abc123.js'],
    });

    it('설정과 매니페스트를 읽어 import map JSON을 생성한다', async () => {
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

    it('--out 옵션이 있으면 파일에 기록한다', async () => {
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

    it('설정 파일이 유효하지 않으면 에러를 던진다', async () => {
      const configPath = resolve('/tmp/invalid.json');

      const mockReadFile = vi.fn().mockResolvedValue('null');
      const mockWriteFile = vi.fn();

      await expect(
        generate({ config: configPath }, mockReadFile as never, mockWriteFile as never),
      ).rejects.toThrow('Invalid config file');
    });

    it('매니페스트가 없는 앱은 건너뛰고 나머지를 생성한다', async () => {
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
