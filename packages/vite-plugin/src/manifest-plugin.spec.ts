import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { esmapManifest } from './manifest-plugin.js';
import type { Plugin } from 'vite';
import type { NormalizedOutputOptions, OutputBundle, OutputChunk, OutputAsset } from 'rollup';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Helper that extracts and calls the writeBundle hook */
async function callWriteBundle(
  plugin: Plugin,
  outDir: string,
  bundle: OutputBundle,
): Promise<void> {
  const hook = plugin.writeBundle;
  if (typeof hook !== 'function') throw new Error('writeBundle hook not found');
  const outputOptions = { dir: outDir } as NormalizedOutputOptions;
  await hook.call({} as never, outputOptions, bundle);
}

/** Creates a test OutputChunk */
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

/** Creates a test OutputAsset */
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

  it('has plugin name esmap:manifest', () => {
    const plugin = esmapManifest({ name: '@flex/checkout' });
    expect(plugin.name).toBe('esmap:manifest');
  });

  it('only applies during build', () => {
    const plugin = esmapManifest({ name: '@flex/checkout' });
    expect(plugin.apply).toBe('build');
  });

  it('sets shared dependencies as externals', () => {
    const plugin = esmapManifest({
      name: '@flex/checkout',
      shared: ['react', 'react-dom'],
    });

    const configHook = plugin.config;
    if (typeof configHook !== 'function') throw new Error('config hook not found');

    const result = configHook.call({} as never, {} as never, {} as never);
    expect(result).toStrictEqual({
      build: {
        rollupOptions: {
          external: ['react', 'react-dom'],
        },
      },
    });
  });

  it('returns an empty config when shared is not provided', () => {
    const plugin = esmapManifest({ name: '@flex/checkout' });

    const configHook = plugin.config;
    if (typeof configHook !== 'function') throw new Error('config hook not found');

    const result = configHook.call({} as never, {} as never, {} as never);
    expect(result).toStrictEqual({});
  });

  it('generates a manifest from the build output', async () => {
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

  it('supports specifying a custom output file name', async () => {
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

  it('uses the first JS file as entry when no entry chunk exists', async () => {
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
