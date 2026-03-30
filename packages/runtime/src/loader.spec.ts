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

  it('injects inline import map into the DOM', async () => {
    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    const result = await loadImportMap({ inlineImportMap: importMap });

    expect(result).toStrictEqual(importMap);

    const script = document.querySelector('script[type="importmap"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toStrictEqual(importMap);
  });

  it('does not inject a new import map when one already exists', async () => {
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

  it('automatically injects modulepreload links', async () => {
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

  it('does not inject preload links when injectPreload is false', async () => {
    const importMap: ImportMap = {
      imports: { react: 'https://cdn.example.com/react.js' },
    };

    await loadImportMap({ inlineImportMap: importMap, injectPreload: false });

    const preloads = document.querySelectorAll('link[rel="modulepreload"]');
    expect(preloads).toHaveLength(0);
  });

  it('does not create duplicate preload links that already exist', async () => {
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

  it('fetches import map from URL', async () => {
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

  it('throws ImportMapLoadError on fetch failure', async () => {
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

  // Missing importMapUrl/inlineImportMap is prevented at compile time by discriminated union

  it('inserts import map before module scripts', async () => {
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

  it('does not preload URLs without .js extension', async () => {
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
