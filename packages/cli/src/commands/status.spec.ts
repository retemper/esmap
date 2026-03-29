import { describe, it, expect, vi } from 'vitest';
import { status, parseStatusFlags, formatStatus } from './status.js';
import type { StatusResult } from './status.js';

/** 성공하는 fetch 모킹을 생성한다. */
function createMockFetch(responseBody: unknown, statusCode = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

describe('status 커맨드', () => {
  describe('parseStatusFlags', () => {
    it('server 플래그를 파싱한다', () => {
      const result = parseStatusFlags({ server: 'http://localhost:3000' });

      expect(result).toStrictEqual({ server: 'http://localhost:3000' });
    });

    it('server 플래그가 없으면 에러를 던진다', () => {
      expect(() => parseStatusFlags({})).toThrow('Missing required flag --server');
    });
  });

  describe('status', () => {
    it('GET / 으로 올바른 요청을 보낸다', async () => {
      const mockFetch = createMockFetch({ imports: {} });

      await status({ server: 'http://localhost:3000' }, mockFetch);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    });

    it('서버 응답의 import map을 반환한다', async () => {
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

    it('scopes가 포함된 import map도 반환한다', async () => {
      const importMap = {
        imports: { react: 'https://esm.sh/react@18' },
        scopes: { '/app/': { lodash: 'https://esm.sh/lodash@4' } },
      };
      const mockFetch = createMockFetch(importMap);

      const result = await status({ server: 'http://localhost:3000' }, mockFetch);

      expect(result.scopes).toStrictEqual({ '/app/': { lodash: 'https://esm.sh/lodash@4' } });
    });

    it('서버가 에러를 반환하면 예외를 던진다', async () => {
      const mockFetch = createMockFetch('Internal error', 500);

      await expect(status({ server: 'http://localhost:3000' }, mockFetch)).rejects.toThrow(
        'Status check failed (500)',
      );
    });

    it('유효하지 않은 응답이면 예외를 던진다', async () => {
      const mockFetch = createMockFetch({ notAnImportMap: true });

      await expect(status({ server: 'http://localhost:3000' }, mockFetch)).rejects.toThrow(
        'Invalid import map response',
      );
    });

    it('서버 URL 끝의 슬래시를 제거한다', async () => {
      const mockFetch = createMockFetch({ imports: {} });

      await status({ server: 'http://localhost:3000/' }, mockFetch);

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:3000/');
    });
  });

  describe('formatStatus', () => {
    it('imports 항목을 정렬하여 표시한다', () => {
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

    it('imports가 비어있으면 안내 메시지를 표시한다', () => {
      const result: StatusResult = { imports: {} };

      const output = formatStatus(result);

      expect(output).toContain('(no imports registered)');
    });

    it('scopes가 있으면 함께 표시한다', () => {
      const result: StatusResult = {
        imports: { react: 'https://esm.sh/react@18' },
        scopes: { '/app/': { lodash: 'https://esm.sh/lodash@4' } },
      };

      const output = formatStatus(result);

      expect(output).toContain('--- Scopes ---');
      expect(output).toContain('/app/');
      expect(output).toContain('lodash');
    });

    it('specifier를 알파벳 순으로 정렬한다', () => {
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
