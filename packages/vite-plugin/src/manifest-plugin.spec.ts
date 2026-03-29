import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { esmapManifest } from './manifest-plugin.js';
import type { Plugin } from 'vite';
import type { NormalizedOutputOptions, OutputBundle, OutputChunk, OutputAsset } from 'rollup';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** writeBundle 훅을 추출하여 실행하는 헬퍼 */
async function callWriteBundle(
  plugin: Plugin,
  outDir: string,
  bundle: OutputBundle,
): Promise<void> {
  const hook = plugin.writeBundle;
  if (typeof hook !== 'function') throw new Error('writeBundle hook이 없음');
  const outputOptions = { dir: outDir } as NormalizedOutputOptions;
  await hook.call({} as never, outputOptions, bundle);
}

/** 테스트용 OutputChunk 생성 */
function createChunk(fileName: string, isEntry: boolean, isDynamicEntry = false): OutputChunk {
  return {
    type: 'chunk',
    fileName,
    isEntry,
    isDynamicEntry,
    code: '',
    name: fileName,
    facadeModuleId: null,
    imports: [],
    dynamicImports: [],
    modules: {},
    exports: [],
    referencedFiles: [],
    implicitlyLoadedBefore: [],
    importedBindings: {},
    map: null,
    sourcemapFileName: null,
    preliminaryFileName: fileName,
    moduleIds: [],
    isImplicitEntry: false,
  };
}

/** 테스트용 OutputAsset 생성 */
function createAsset(fileName: string): OutputAsset {
  return {
    type: 'asset',
    fileName,
    name: fileName,
    needsCodeReference: false,
    source: '',
    originalFileNames: [],
    originalFileName: null,
    names: [],
  };
}

describe('esmapManifest', () => {
  const testDir = join(tmpdir(), `esmap-manifest-test-${Date.now()}`);

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('플러그인 이름이 esmap:manifest이다', () => {
    const plugin = esmapManifest({ name: '@flex/checkout' });
    expect(plugin.name).toBe('esmap:manifest');
  });

  it('빌드 시에만 적용된다', () => {
    const plugin = esmapManifest({ name: '@flex/checkout' });
    expect(plugin.apply).toBe('build');
  });

  it('shared 의존성을 externals로 설정한다', () => {
    const plugin = esmapManifest({
      name: '@flex/checkout',
      shared: ['react', 'react-dom'],
    });

    const configHook = plugin.config;
    if (typeof configHook !== 'function') throw new Error('config hook이 없음');

    const result = configHook.call({} as never, {} as never, {} as never);
    expect(result).toStrictEqual({
      build: {
        rollupOptions: {
          external: ['react', 'react-dom'],
        },
      },
    });
  });

  it('shared가 없으면 빈 config를 반환한다', () => {
    const plugin = esmapManifest({ name: '@flex/checkout' });

    const configHook = plugin.config;
    if (typeof configHook !== 'function') throw new Error('config hook이 없음');

    const result = configHook.call({} as never, {} as never, {} as never);
    expect(result).toStrictEqual({});
  });

  it('빌드 결과물에서 manifest를 생성한다', async () => {
    const plugin = esmapManifest({
      name: '@flex/checkout',
      version: '1.2.3',
      shared: ['react'],
      internal: ['@flex-packages/router'],
    });

    const bundle: OutputBundle = {
      'checkout-abc123.js': createChunk('checkout-abc123.js', true),
      'checkout-page-def456.js': createChunk('checkout-page-def456.js', false, true),
      'checkout-styles-ghi789.css': createAsset('checkout-styles-ghi789.css'),
    };

    await callWriteBundle(plugin, testDir, bundle);

    const manifestPath = join(testDir, 'esmap-manifest.json');
    const content = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    expect(manifest.name).toBe('@flex/checkout');
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.entry).toBe('checkout-abc123.js');
    expect(manifest.assets).toStrictEqual([
      'checkout-abc123.js',
      'checkout-page-def456.js',
      'checkout-styles-ghi789.css',
    ]);
    expect(manifest.dependencies.shared).toStrictEqual(['react']);
    expect(manifest.dependencies.internal).toStrictEqual(['@flex-packages/router']);
    expect(manifest.modulepreload).toContain('checkout-abc123.js');
    expect(manifest.modulepreload).toContain('checkout-page-def456.js');
  });

  it('커스텀 출력 파일명을 지정할 수 있다', async () => {
    const plugin = esmapManifest({
      name: '@flex/checkout',
      version: '1.0.0',
      outputFileName: 'custom-manifest.json',
    });

    const bundle: OutputBundle = {
      'index.js': createChunk('index.js', true),
    };

    await callWriteBundle(plugin, testDir, bundle);

    const content = await readFile(join(testDir, 'custom-manifest.json'), 'utf-8');
    const manifest = JSON.parse(content);
    expect(manifest.name).toBe('@flex/checkout');
  });

  it('엔트리 청크가 없으면 첫 번째 JS 파일을 entry로 사용한다', async () => {
    const plugin = esmapManifest({
      name: '@flex/checkout',
      version: '1.0.0',
    });

    const nonEntryChunk = createChunk('main-abc.js', false);
    const bundle: OutputBundle = {
      'main-abc.js': nonEntryChunk,
    };

    await callWriteBundle(plugin, testDir, bundle);

    const content = await readFile(join(testDir, 'esmap-manifest.json'), 'utf-8');
    const manifest = JSON.parse(content);
    expect(manifest.entry).toBe('main-abc.js');
  });
});
