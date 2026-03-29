import { describe, it, expect, vi } from 'vitest';
import { rollback, parseRollbackFlags } from './rollback.js';
import type { RollbackOptions } from './rollback.js';

/** 성공하는 fetch 모킹을 생성한다. */
function createMockFetch(responseBody: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

describe('rollback 커맨드', () => {
  describe('parseRollbackFlags', () => {
    it('필수 플래그를 정상적으로 파싱한다', () => {
      const result = parseRollbackFlags({
        server: 'http://localhost:3000',
        name: '@flex/checkout',
      });

      expect(result).toStrictEqual({
        server: 'http://localhost:3000',
        name: '@flex/checkout',
      });
    });

    it('server 플래그가 없으면 에러를 던진다', () => {
      expect(() => parseRollbackFlags({ name: 'app' })).toThrow('Missing required flag --server');
    });

    it('name 플래그가 없으면 에러를 던진다', () => {
      expect(() => parseRollbackFlags({ server: 'http://x' })).toThrow(
        'Missing required flag --name',
      );
    });
  });

  describe('rollback', () => {
    it('POST /rollback/:name 으로 올바른 요청을 보낸다', async () => {
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

    it('서버 응답에서 name과 url을 추출하여 결과를 반환한다', async () => {
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

    it('서버가 에러를 반환하면 예외를 던진다', async () => {
      const mockFetch = createMockFetch('Service not found', 404);

      await expect(
        rollback({ server: 'http://localhost:3000', name: 'unknown' }, mockFetch),
      ).rejects.toThrow('Rollback failed (404)');
    });

    it('서버 URL 끝의 슬래시를 제거한다', async () => {
      const mockFetch = createMockFetch({ service: 'app', rolledBackTo: 'http://x' });

      await rollback({ server: 'http://localhost:3000/', name: 'app' }, mockFetch);

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:3000/rollback/app');
    });

    it('응답 본문이 기대 형태가 아니면 에러를 던진다', async () => {
      const mockFetch = createMockFetch({ status: 'ok' });

      await expect(
        rollback({ server: 'http://localhost:3000', name: 'app' }, mockFetch),
      ).rejects.toThrow('서버 응답 형식이 올바르지 않습니다');
    });
  });
});
