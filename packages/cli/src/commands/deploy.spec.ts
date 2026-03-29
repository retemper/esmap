import { describe, it, expect, vi } from 'vitest';
import { deploy, parseDeployFlags, resolveUrlFromManifest } from './deploy.js';
import type { DeployOptions } from './deploy.js';

/** 성공하는 fetch 모킹을 생성한다. */
function createMockFetch(responseBody: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

describe('deploy 커맨드', () => {
  describe('parseDeployFlags', () => {
    it('필수 플래그를 정상적으로 파싱한다', () => {
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

    it('선택적 플래그도 파싱한다', () => {
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

    it('필수 플래그가 없으면 에러를 던진다', () => {
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
    it('PATCH /services/:name 으로 올바른 요청을 보낸다', async () => {
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

    it('deployedBy가 있으면 요청 본문에 포함한다', async () => {
      const mockFetch = createMockFetch({ service: 'app', url: 'http://x' });

      await deploy(
        { server: 'http://localhost:3000', name: 'app', url: 'http://x', deployedBy: 'ci' },
        mockFetch,
      );

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.deployedBy).toBe('ci');
    });

    it('서버 응답에서 name과 url을 추출하여 결과를 반환한다', async () => {
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

    it('서버가 에러를 반환하면 예외를 던진다', async () => {
      const mockFetch = createMockFetch('Not found', 404);

      await expect(
        deploy({ server: 'http://localhost:3000', name: 'app', url: 'http://x' }, mockFetch),
      ).rejects.toThrow('Deploy failed (404)');
    });

    it('서버 URL 끝의 슬래시를 제거한다', async () => {
      const mockFetch = createMockFetch({ service: 'app', url: 'http://x' });

      await deploy({ server: 'http://localhost:3000/', name: 'app', url: 'http://x' }, mockFetch);

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:3000/services/app');
    });

    it('응답 본문이 기대 형태가 아니면 옵션 값으로 결과를 구성한다', async () => {
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
    it('함수가 정의되어 있다', () => {
      expect(typeof resolveUrlFromManifest).toBe('function');
    });
  });
});
