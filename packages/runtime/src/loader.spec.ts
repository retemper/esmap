import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadImportMap } from './loader.js';
import type { ImportMap } from '@esmap/shared';
import { ImportMapLoadError } from '@esmap/shared';

describe('loadImportMap', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('인라인 import map을 DOM에 주입한다', async () => {
    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    const result = await loadImportMap({ inlineImportMap: importMap });

    expect(result).toStrictEqual(importMap);

    const script = document.querySelector('script[type="importmap"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toStrictEqual(importMap);
  });

  it('이미 import map이 있으면 새로 주입하지 않는다', async () => {
    const existing = document.createElement('script');
    existing.type = 'importmap';
    existing.textContent = '{"imports":{}}';
    document.head.appendChild(existing);

    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    await loadImportMap({ inlineImportMap: importMap });

    const scripts = document.querySelectorAll('script[type="importmap"]');
    expect(scripts).toHaveLength(1);
  });

  it('modulepreload 링크를 자동 주입한다', async () => {
    const importMap: ImportMap = {
      imports: {
        react: 'https://cdn.example.com/react.js',
        '@flex/checkout': 'https://cdn.example.com/checkout.js',
      },
    };

    await loadImportMap({ inlineImportMap: importMap });

    const preloads = document.querySelectorAll('link[rel="modulepreload"]');
    expect(preloads).toHaveLength(2);
  });

  it('injectPreload: false이면 preload 링크를 주입하지 않는다', async () => {
    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    await loadImportMap({ inlineImportMap: importMap, injectPreload: false });

    const preloads = document.querySelectorAll('link[rel="modulepreload"]');
    expect(preloads).toHaveLength(0);
  });

  it('이미 존재하는 preload 링크는 중복 생성하지 않는다', async () => {
    const existing = document.createElement('link');
    existing.rel = 'modulepreload';
    existing.href = 'https://cdn.example.com/react.js';
    document.head.appendChild(existing);

    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    await loadImportMap({ inlineImportMap: importMap });

    const preloads = document.querySelectorAll('link[rel="modulepreload"]');
    expect(preloads).toHaveLength(1);
  });

  it('URL에서 import map을 fetch한다', async () => {
    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(importMap),
    });

    const result = await loadImportMap({ importMapUrl: 'https://api.example.com/importmap' });

    expect(result).toStrictEqual(importMap);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/importmap');
  });

  it('fetch 실패 시 ImportMapLoadError를 던진다', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      loadImportMap({ importMapUrl: 'https://api.example.com/importmap' }),
    ).rejects.toThrow(ImportMapLoadError);

    try {
      await loadImportMap({ importMapUrl: 'https://api.example.com/importmap' });
    } catch (e) {
      expect(e).toBeInstanceOf(ImportMapLoadError);
      const err = e as ImportMapLoadError;
      expect(err.url).toBe('https://api.example.com/importmap');
      expect(err.status).toBe(500);
      expect(err.code).toBe('IMPORT_MAP_LOAD_ERROR');
    }
  });

  // importMapUrl/inlineImportMap 누락은 discriminated union으로 컴파일 시점에 방지됨

  it('module 스크립트 앞에 import map을 삽입한다', async () => {
    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';
    moduleScript.src = 'https://example.com/app.js';
    document.head.appendChild(moduleScript);

    await loadImportMap({
      inlineImportMap: { imports: { react: 'https://cdn.example.com/react.js' } },
    });

    const children = Array.from(document.head.children);
    const importMapIdx = children.findIndex(
      (el) => el instanceof HTMLScriptElement && el.type === 'importmap',
    );
    const moduleIdx = children.findIndex(
      (el) => el instanceof HTMLScriptElement && el.type === 'module',
    );

    expect(importMapIdx).toBeLessThan(moduleIdx);
  });

  it('.js 확장자가 아닌 URL은 preload하지 않는다', async () => {
    const importMap: ImportMap = {
      imports: {
        react: 'https://cdn.example.com/react.js',
        styles: 'https://cdn.example.com/styles.css',
      },
    };

    await loadImportMap({ inlineImportMap: importMap });

    const preloads = document.querySelectorAll('link[rel="modulepreload"]');
    expect(preloads).toHaveLength(1);
  });
});
